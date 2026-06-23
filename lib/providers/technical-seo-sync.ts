import { prisma } from "@/lib/db/client";
import { Prisma } from "@/generated/prisma/client";
import { createSiteAlert } from "@/lib/providers/alert-sync";

type AuditIssue = {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
};

type SyncResult = {
  provider: string;
  ok: boolean;
  rows: number;
  error?: string;
};

const MAX_URLS_PER_RUN = 30;
const USER_AGENT = "SEO-GEO-Visibility-Dashboard/1.0";

function textLength(value: string | null) {
  return value ? value.trim().length : null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function attrValue(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function firstMatch(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1].replace(/<[^>]+>/g, " ")) : null;
}

function metaContent(html: string, name: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const tagName = attrValue(tag, "name") ?? attrValue(tag, "property");
    if (tagName?.toLowerCase() === name.toLowerCase()) return attrValue(tag, "content");
  }
  return null;
}

function canonicalHref(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (attrValue(tag, "rel")?.toLowerCase() === "canonical") return attrValue(tag, "href");
  }
  return null;
}

function countMatches(html: string, pattern: RegExp) {
  return html.match(pattern)?.length ?? 0;
}

function wordCount(html: string) {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

function linkCounts(html: string, pageUrl: string) {
  const origin = new URL(pageUrl).origin;
  let internalLinks = 0;
  let externalLinks = 0;
  const tags = html.match(/<a\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const href = attrValue(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const target = new URL(href, pageUrl);
      if (target.origin === origin) internalLinks += 1;
      else externalLinks += 1;
    } catch {
      continue;
    }
  }
  return { internalLinks, externalLinks };
}

function imageStats(html: string) {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imageMissingAltCount = tags.filter((tag) => !attrValue(tag, "alt")).length;
  return { imageCount: tags.length, imageMissingAltCount };
}

function calculateScore(params: {
  titleLength: number | null;
  metaDescriptionLength: number | null;
  h1Count: number;
  canonical: string | null;
  robotsMeta: string | null;
  imageCount: number;
  imageMissingAltCount: number;
  internalLinks: number;
  wordCount: number;
  schemaDetected: boolean;
}) {
  const issues: AuditIssue[] = [];
  let score = 100;

  if (!params.titleLength) {
    score -= 18;
    issues.push({ code: "missing_title", severity: "HIGH", message: "Missing page title." });
  } else if (params.titleLength < 20 || params.titleLength > 70) {
    score -= 8;
    issues.push({ code: "title_length", severity: "MEDIUM", message: "Title length is outside the recommended range." });
  }

  if (!params.metaDescriptionLength) {
    score -= 12;
    issues.push({ code: "missing_meta_description", severity: "MEDIUM", message: "Missing meta description." });
  } else if (params.metaDescriptionLength < 50 || params.metaDescriptionLength > 180) {
    score -= 6;
    issues.push({ code: "meta_description_length", severity: "LOW", message: "Meta description length is outside the recommended range." });
  }

  if (params.h1Count !== 1) {
    score -= params.h1Count === 0 ? 12 : 6;
    issues.push({ code: "h1_count", severity: "MEDIUM", message: "Page should have exactly one H1." });
  }

  if (!params.canonical) {
    score -= 8;
    issues.push({ code: "missing_canonical", severity: "MEDIUM", message: "Missing canonical link." });
  }

  if (params.robotsMeta?.toLowerCase().includes("noindex")) {
    score -= 25;
    issues.push({ code: "noindex", severity: "HIGH", message: "Robots meta contains noindex." });
  }

  if (params.imageCount > 0 && params.imageMissingAltCount > 0) {
    score -= Math.min(12, params.imageMissingAltCount * 2);
    issues.push({ code: "image_alt", severity: "LOW", message: "Some images are missing alt text." });
  }

  if (params.internalLinks === 0) {
    score -= 8;
    issues.push({ code: "internal_links", severity: "LOW", message: "No internal links found." });
  }

  if (params.wordCount < 150) {
    score -= 8;
    issues.push({ code: "thin_content", severity: "LOW", message: "Page appears to have thin text content." });
  }

  if (!params.schemaDetected) {
    score -= 5;
    issues.push({ code: "schema", severity: "LOW", message: "No structured data detected." });
  }

  return { seoScore: Math.max(0, score), issues };
}

async function auditUrl(siteId: string, urlId: string, targetUrl: string) {
  const response = await fetch(targetUrl, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  const title = firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = metaContent(html, "description");
  const robotsMeta = metaContent(html, "robots");
  const canonical = canonicalHref(html);
  const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
  const images = imageStats(html);
  const links = linkCounts(html, targetUrl);
  const words = wordCount(html);
  const schemaDetected = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html) || /\bitemscope\b|\bitemtype=/i.test(html);
  const titleLength = textLength(title);
  const metaDescriptionLength = textLength(metaDescription);
  const scored = calculateScore({
    titleLength,
    metaDescriptionLength,
    h1Count,
    canonical,
    robotsMeta,
    imageCount: images.imageCount,
    imageMissingAltCount: images.imageMissingAltCount,
    internalLinks: links.internalLinks,
    wordCount: words,
    schemaDetected,
  });

  await prisma.url.update({
    where: { id: urlId },
    data: { statusCode: response.status, lastCrawledAt: new Date() },
  });

  await prisma.technicalSeoAudit.create({
    data: {
      siteId,
      urlId,
      title,
      titleLength,
      metaDescription,
      metaDescriptionLength,
      h1Count,
      canonical,
      robotsMeta,
      imageCount: images.imageCount,
      imageMissingAltCount: images.imageMissingAltCount,
      internalLinks: links.internalLinks,
      externalLinks: links.externalLinks,
      schemaDetected,
      wordCount: words,
      seoScore: scored.seoScore,
      issuesJson: scored.issues as unknown as Prisma.InputJsonValue,
    },
  });
  return { seoScore: scored.seoScore, issues: scored.issues };
}

export async function runTechnicalSeoAudit(siteId: string): Promise<SyncResult> {
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) throw new Error("Site not found");

    const urls = await prisma.url.findMany({
      where: { siteId },
      orderBy: [{ isCore: "desc" }, { isInSitemap: "desc" }, { url: "asc" }],
      take: MAX_URLS_PER_RUN,
      select: { id: true, url: true },
    });
    if (urls.length === 0) throw new Error("No URLs are available for technical SEO audit.");

    let rows = 0;
    const errors: string[] = [];
    for (const item of urls) {
      try {
        const result = await auditUrl(siteId, item.id, item.url);
        const highIssues = result.issues.filter((issue) => issue.severity === "HIGH");
        if (highIssues.length > 0 || result.seoScore < 80) {
          await createSiteAlert(siteId, {
            alertType: "TECHNICAL_SEO",
            severity: highIssues.length > 0 ? "HIGH" : "MEDIUM",
            title: `技术 SEO 问题：${item.url}`,
            message: highIssues.length > 0 ? highIssues.map((issue) => issue.message).join("; ") : `页面技术 SEO 分数 ${result.seoScore}，建议检查标题、Meta、H1、Canonical 和内容质量。`,
          }).catch(() => undefined);
        }
        rows += 1;
      } catch (error) {
        errors.push(`${item.url}: ${error instanceof Error ? error.message : "audit failed"}`);
      }
    }

    if (rows === 0) throw new Error(errors.join("\n") || "Technical SEO audit failed.");
    return { provider: "technical-seo", ok: errors.length === 0, rows, error: errors.length ? errors.join("\n") : undefined };
  } catch (error) {
    return { provider: "technical-seo", ok: false, rows: 0, error: error instanceof Error ? error.message : "Technical SEO audit failed." };
  }
}
