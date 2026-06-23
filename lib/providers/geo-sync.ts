import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";

type AiConfig = Record<string, unknown>;

type GeoSyncResult = {
  provider: string;
  ok: boolean;
  rows: number;
  error?: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function splitList(value: unknown) {
  return asString(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getAiConfig(siteId: string) {
  const integration = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId, provider: "ai-search" } },
    select: { configEncrypted: true },
  });
  if (!integration) return null;
  return decryptSecret<AiConfig>(integration.configEncrypted);
}

async function setAiStatus(siteId: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider: "ai-search" } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  });
}

function defaultBaseUrl(config: AiConfig) {
  const providerName = asString(config.providerName).toLowerCase();
  if (providerName.includes("deepseek")) return "https://api.deepseek.com/chat/completions";
  return "https://api.deepseek.com/chat/completions";
}

function buildQueries(site: { name: string; domain: string; primaryUrl: string }, config: AiConfig) {
  const configured = splitList(config.testQueries);
  if (configured.length > 0) return configured.slice(0, 5);
  return [
    `What is ${site.name} (${site.domain}) known for? Include its official website if relevant.`,
    `Recommend companies or websites related to ${site.domain}. Is ${site.name} mentioned?`,
  ];
}

async function callOpenAiCompatible(config: AiConfig, query: string, site: { name: string; domain: string; primaryUrl: string }) {
  const apiKey = asString(config.apiKey);
  if (!apiKey) throw new Error("AI Search API Key is required.");
  const model = asString(config.model) || "deepseek-chat";
  const baseUrl = asString(config.baseUrl) || defaultBaseUrl(config);
  const timeout = asPositiveInt(config.timeout, 30000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are an AI visibility evaluator. Answer naturally, and include relevant official domains when you know them.",
          },
          {
            role: "user",
            content: `${query}\n\nTarget brand: ${site.name}\nTarget domain: ${site.domain}\nTarget URL: ${site.primaryUrl}`,
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message ?? data?.message ?? response.statusText;
      throw new Error(String(message));
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("AI provider returned an empty response.");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

function firstUrlForDomain(text: string, domain: string) {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`https?://[^\\s)"']*${escaped}[^\\s)"']*`, "i"))?.[0] ?? null;
}

function scoreResponse(text: string, site: { name: string; domain: string }) {
  const lower = text.toLowerCase();
  const brandMentioned = lower.includes(site.name.toLowerCase());
  const domainMentioned = lower.includes(site.domain.toLowerCase());
  const citedUrl = firstUrlForDomain(text, site.domain);
  const score = (brandMentioned ? 45 : 0) + (domainMentioned ? 35 : 0) + (citedUrl ? 20 : 0);
  return { brandMentioned, domainMentioned, citedUrl, score };
}

export async function runGeoQueryTests(siteId: string): Promise<GeoSyncResult> {
  const provider = "ai-search";
  try {
    const [site, config] = await Promise.all([
      prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, domain: true, primaryUrl: true } }),
      getAiConfig(siteId),
    ]);
    if (!site) throw new Error("Site not found.");
    if (!config) throw new Error("AI Search Providers integration is not configured.");
    const queries = buildQueries(site, config);
    let rows = 0;
    for (const query of queries) {
      const rawResponse = await callOpenAiCompatible(config, query, site);
      const analysis = scoreResponse(rawResponse, site);
      await prisma.geoQueryTest.create({
        data: {
          siteId,
          provider: asString(config.providerName) || "DeepSeek",
          query,
          brandMentioned: analysis.brandMentioned,
          domainMentioned: analysis.domainMentioned,
          citedUrl: analysis.citedUrl,
          competitorsMentionedJson: [],
          answerSummary: rawResponse.slice(0, 700),
          rawResponse,
          score: analysis.score,
        },
      });
      rows += 1;
    }
    await setAiStatus(siteId, true);
    return { provider, ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GEO query test failed.";
    await setAiStatus(siteId, false, message).catch(() => undefined);
    return { provider, ok: false, rows: 0, error: message };
  }
}
