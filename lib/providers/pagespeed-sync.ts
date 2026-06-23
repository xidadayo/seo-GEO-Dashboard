import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";
import { pathFromUrl } from "@/lib/sitemap";
import { Prisma } from "@/generated/prisma/client";
import { createSiteAlert } from "@/lib/providers/alert-sync";

type ProviderConfig = Record<string, unknown>;

type SyncResult = {
  provider: string;
  ok: boolean;
  rows: number;
  error?: string;
};

type RunOptions = {
  urls?: string[];
  strategies?: string[];
};

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, { numericValue?: number | null }>;
  };
  error?: {
    message?: string;
  };
};

const PROVIDER = "pagespeed";
const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const DEFAULT_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const MAX_URLS_PER_RUN = 10;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function score(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;
}

function seconds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value / 1000 : null;
}

function milliseconds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function splitList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean);
  return asString(value).split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeStrategies(values: string[]) {
  const normalized = values.flatMap((value) => value.toLowerCase() === "both" ? ["mobile", "desktop"] : [value.toLowerCase()]);
  const strategies = normalized.filter((value) => value === "mobile" || value === "desktop");
  return Array.from(new Set(strategies.length > 0 ? strategies : ["mobile"]));
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function getConfig(siteId: string) {
  const integration = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId, provider: PROVIDER } },
    select: { configEncrypted: true },
  });
  if (!integration) return null;
  return decryptSecret<ProviderConfig>(integration.configEncrypted);
}

async function setIntegrationStatus(siteId: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider: PROVIDER } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  });
}

async function getTargetUrls(siteId: string, config: ProviderConfig | null, requestedUrls: string[] | undefined) {
  const configuredUrls = splitList(config?.coreUrls);
  const manualUrls = requestedUrls?.map(asString).filter(Boolean) ?? [];
  const explicitUrls = [...manualUrls, ...configuredUrls].map(normalizeUrl).filter((url): url is string => Boolean(url));
  if (explicitUrls.length > 0) return Array.from(new Set(explicitUrls)).slice(0, MAX_URLS_PER_RUN);

  const coreUrls = await prisma.url.findMany({
    where: { siteId, isCore: true },
    orderBy: { url: "asc" },
    take: MAX_URLS_PER_RUN,
    select: { url: true },
  });
  if (coreUrls.length > 0) return coreUrls.map((row) => row.url);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { primaryUrl: true },
  });
  const primaryUrl = site ? normalizeUrl(site.primaryUrl) : null;
  return primaryUrl ? [primaryUrl] : [];
}

async function fetchPageSpeed(url: string, strategy: string, apiKey: string) {
  const params = new URLSearchParams({ url, strategy });
  for (const category of DEFAULT_CATEGORIES) params.append("category", category);
  if (apiKey) params.set("key", apiKey);

  const response = await fetch(`${ENDPOINT}?${params.toString()}`);
  const data = await response.json().catch(() => ({})) as PageSpeedResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? response.statusText);
  }
  return data;
}

function extractMetrics(data: PageSpeedResponse) {
  const categories = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};
  return {
    performanceScore: score(categories.performance?.score),
    seoScore: score(categories.seo?.score),
    accessibilityScore: score(categories.accessibility?.score),
    bestPracticesScore: score(categories["best-practices"]?.score),
    lcp: seconds(audits["largest-contentful-paint"]?.numericValue),
    inp: milliseconds(audits["interaction-to-next-paint"]?.numericValue),
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    fcp: seconds(audits["first-contentful-paint"]?.numericValue),
    ttfb: seconds(audits["server-response-time"]?.numericValue ?? audits["experimental-time-to-first-byte"]?.numericValue),
  };
}

export async function runPageSpeedChecks(siteId: string, options: RunOptions = {}): Promise<SyncResult> {
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) throw new Error("Site not found");

    const config = await getConfig(siteId);
    const urls = await getTargetUrls(siteId, config, options.urls);
    if (urls.length === 0) throw new Error("No valid URL is available for PageSpeed checks.");

    const strategies = normalizeStrategies(options.strategies?.length ? options.strategies : splitList(config?.defaultStrategy));
    const apiKey = asString(config?.apiKey);
    let rows = 0;

    for (const targetUrl of urls) {
      const urlRecord = await prisma.url.upsert({
        where: { siteId_url: { siteId, url: targetUrl } },
        update: { path: pathFromUrl(targetUrl) },
        create: { siteId, url: targetUrl, path: pathFromUrl(targetUrl), isCore: true },
        select: { id: true },
      });

      for (const strategy of strategies) {
        const data = await fetchPageSpeed(targetUrl, strategy, apiKey);
        const metrics = extractMetrics(data);
        await prisma.pageSpeedResult.create({
          data: {
            siteId,
            urlId: urlRecord.id,
            strategy,
            ...metrics,
            rawJson: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          },
        });
        if (metrics.performanceScore != null && metrics.performanceScore < 50) {
          await createSiteAlert(siteId, {
            alertType: "PAGESPEED",
            severity: "HIGH",
            title: `PageSpeed 性能过低：${targetUrl}`,
            message: `${strategy} 性能分 ${metrics.performanceScore}，建议优先优化 LCP、图片、缓存和阻塞资源。`,
          }).catch(() => undefined);
        }
        rows += 1;
      }
    }

    if (config) await setIntegrationStatus(siteId, true);
    return { provider: PROVIDER, ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PageSpeed sync failed.";
    await setIntegrationStatus(siteId, false, message).catch(() => undefined);
    return { provider: PROVIDER, ok: false, rows: 0, error: message };
  }
}
