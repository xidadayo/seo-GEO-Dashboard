import { subDays, format } from "date-fns";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";
import { getServiceAccountAccessToken } from "@/lib/providers/google-auth";

type ProviderConfig = Record<string, unknown>;

type SyncResult = {
  provider: string;
  ok: boolean;
  rows: number;
  error?: string;
};

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function today(offsetDays = 0) {
  return format(subDays(new Date(), offsetDays), "yyyy-MM-dd");
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function intMetric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function floatMetric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

async function getConfig(siteId: string, provider: string) {
  const integration = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId, provider } },
    select: { configEncrypted: true },
  });
  if (!integration) return null;
  return decryptSecret<ProviderConfig>(integration.configEncrypted);
}

async function setIntegrationStatus(siteId: string, provider: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  });
}

async function googleJson<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetchWithRetry(
    () => fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    `Google API request (${url})`,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message ?? data?.error ?? response.statusText;
    throw new Error(String(message));
  }
  return data as T;
}

async function inspectUrl(token: string, inspectionUrl: string, siteUrl: string) {
  return googleJson<{
    inspectionResult?: {
      inspectionResultLink?: string;
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        googleCanonical?: string;
        userCanonical?: string;
        sitemap?: string | string[];
      };
    };
  }>(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    token,
    { inspectionUrl, siteUrl },
  );
}

async function fetchWithRetry(request: () => Promise<Response>, label: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request();
      if (!isRetryableStatus(response.status) || attempt === attempts) return response;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt === attempts) {
        throw new Error(`${label} failed before response: ${describeFetchError(error)}`);
      }
    }
    await sleep(750 * attempt);
  }
  throw new Error(`${label} failed: ${describeFetchError(lastError)}`);
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function isRetryableFetchError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: string } | undefined;
  return ["UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(cause?.code ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeRecord = cause as { code?: string; errno?: string; syscall?: string; hostname?: string; message?: string };
    return [
      error.message,
      causeRecord.code ? `code=${causeRecord.code}` : null,
      causeRecord.errno ? `errno=${causeRecord.errno}` : null,
      causeRecord.syscall ? `syscall=${causeRecord.syscall}` : null,
      causeRecord.hostname ? `host=${causeRecord.hostname}` : null,
      causeRecord.message ? `cause=${causeRecord.message}` : null,
    ].filter(Boolean).join("; ");
  }
  return error.message;
}

export async function syncGscSearchPerformance(siteId: string): Promise<SyncResult> {
  const provider = "google-search-console";
  try {
    const config = await getConfig(siteId, provider);
    if (!config) throw new Error("Google Search Console integration is not configured.");
    const siteUrl = asString(config.gscProperty) || asString(config.siteUrl);
    if (!siteUrl) throw new Error("GSC Property is required.");
    const token = await getServiceAccountAccessToken(config.serviceAccountJson, [GSC_SCOPE]);
    const startDate = today(28);
    const endDate = today(2);
    const data = await googleJson<{ rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> }>(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      token,
      {
        startDate,
        endDate,
        dimensions: ["date", "query", "page", "country", "device"],
        rowLimit: 25000,
        dataState: "all",
      },
    );
    await prisma.gscSearchPerformance.deleteMany({
      where: { siteId, date: { gte: new Date(`${startDate}T00:00:00.000Z`), lte: new Date(`${endDate}T23:59:59.999Z`) } },
    });
    const rows = data.rows ?? [];
    if (rows.length > 0) {
      await prisma.gscSearchPerformance.createMany({
        data: rows.map((row) => {
          const [date, query, page, country, device] = row.keys ?? [];
          return {
            siteId,
            date: new Date(`${date}T00:00:00.000Z`),
            query: query ?? "",
            page: page ?? "",
            country: country || null,
            device: device || null,
            clicks: floatMetric(row.clicks),
            impressions: floatMetric(row.impressions),
            ctr: floatMetric(row.ctr),
            position: floatMetric(row.position),
          };
        }),
      });
    }
    await setIntegrationStatus(siteId, provider, true);
    return { provider, ok: true, rows: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GSC sync failed.";
    await setIntegrationStatus(siteId, provider, false, message).catch(() => undefined);
    return { provider, ok: false, rows: 0, error: message };
  }
}

export async function syncGscUrlInspection(siteId: string): Promise<SyncResult> {
  const provider = "google-search-console";
  try {
    const config = await getConfig(siteId, provider);
    if (!config) throw new Error("Google Search Console integration is not configured.");
    const siteUrl = asString(config.gscProperty) || asString(config.siteUrl);
    if (!siteUrl) throw new Error("GSC Property is required.");
    const token = await getServiceAccountAccessToken(config.serviceAccountJson, [GSC_SCOPE]);
    const limit = Math.min(200, positiveInt(config.inspectionUrlLimit, 50));
    const urls = await prisma.url.findMany({
      where: { siteId, isInSitemap: true },
      orderBy: [{ isCore: "desc" }, { url: "asc" }],
      take: limit,
      select: { id: true, url: true },
    });
    if (urls.length === 0) return { provider: "google-url-inspection", ok: false, rows: 0, error: "No sitemap URLs are available for URL Inspection." };

    let rows = 0;
    const errors: string[] = [];
    for (const item of urls) {
      try {
        const data = await inspectUrl(token, item.url, siteUrl);
        const status = data.inspectionResult?.indexStatusResult;
        if (!status) throw new Error("URL Inspection response did not include indexStatusResult.");
        const sitemap = Array.isArray(status.sitemap) ? status.sitemap.join(", ") : status.sitemap;
        await prisma.gscIndexStatus.deleteMany({ where: { siteId, urlId: item.id } });
        await prisma.gscIndexStatus.create({
          data: {
            siteId,
            urlId: item.id,
            verdict: status.verdict ?? null,
            coverageState: status.coverageState ?? null,
            indexingState: status.indexingState ?? null,
            robotsTxtState: status.robotsTxtState ?? null,
            googleCanonical: status.googleCanonical ?? null,
            userCanonical: status.userCanonical ?? null,
            sitemap: sitemap ?? null,
            lastCrawlTime: status.lastCrawlTime ? new Date(status.lastCrawlTime) : null,
            rawJson: data,
          },
        });
        rows += 1;
      } catch (error) {
        errors.push(`${item.url}: ${error instanceof Error ? error.message : "Inspection failed."}`);
      }
      await sleep(250);
    }
    if (rows === 0) throw new Error(errors.slice(0, 3).join("; ") || "URL Inspection failed.");
    await setIntegrationStatus(siteId, provider, true);
    return { provider: "google-url-inspection", ok: errors.length === 0, rows, error: errors.length ? errors.slice(0, 3).join("; ") : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL Inspection sync failed.";
    await setIntegrationStatus(siteId, provider, false, message).catch(() => undefined);
    return { provider: "google-url-inspection", ok: false, rows: 0, error: message };
  }
}

export async function syncGa4Traffic(siteId: string): Promise<SyncResult> {
  const provider = "ga4";
  try {
    const config = await getConfig(siteId, provider);
    if (!config) throw new Error("GA4 integration is not configured.");
    const gscConfig = await getConfig(siteId, "google-search-console");
    const propertyId = asString(config.propertyId);
    if (!propertyId) throw new Error("GA4 Property ID is required.");
    const token = await getServiceAccountAccessToken(config.serviceAccountJson ?? gscConfig?.serviceAccountJson, [GA4_SCOPE]);
    const startDate = today(28);
    const endDate = today(1);
    const data = await googleJson<{ rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> }>(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      token,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "pagePath" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "country" },
          { name: "deviceCategory" },
        ],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "conversions" },
          { name: "eventCount" },
        ],
        limit: "10000",
      },
    );
    await prisma.ga4DailyTraffic.deleteMany({
      where: { siteId, date: { gte: new Date(`${startDate}T00:00:00.000Z`), lte: new Date(`${endDate}T23:59:59.999Z`) } },
    });
    const rows = data.rows ?? [];
    if (rows.length > 0) {
      await prisma.ga4DailyTraffic.createMany({
        data: rows.map((row) => {
          const dimensions = row.dimensionValues?.map((value) => value.value ?? "") ?? [];
          const metrics = row.metricValues?.map((value) => value.value ?? "0") ?? [];
          const [date, pagePath, source, medium, country, device] = dimensions;
          return {
            siteId,
            date: new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00.000Z`),
            pagePath: pagePath || null,
            source: source || null,
            medium: medium || null,
            country: country || null,
            device: device || null,
            activeUsers: intMetric(metrics[0]),
            sessions: intMetric(metrics[1]),
            pageViews: intMetric(metrics[2]),
            conversions: intMetric(metrics[3]),
            eventCount: intMetric(metrics[4]),
          };
        }),
      });
    }
    await syncGa4Realtime(siteId, propertyId, token);
    await setIntegrationStatus(siteId, provider, true);
    return { provider, ok: true, rows: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 sync failed.";
    await setIntegrationStatus(siteId, provider, false, message).catch(() => undefined);
    return { provider, ok: false, rows: 0, error: message };
  }
}

async function syncGa4Realtime(siteId: string, propertyId: string, token: string) {
  const data = await googleJson<{ rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> }>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    token,
    {
      dimensions: [{ name: "country" }, { name: "unifiedPagePathScreen" }, { name: "eventName" }],
      metrics: [{ name: "activeUsers" }],
      limit: "1000",
    },
  ).catch(() => ({ rows: [] }));
  await prisma.ga4RealtimeSnapshot.deleteMany({ where: { siteId } });
  const rows = data.rows ?? [];
  if (rows.length > 0) {
    await prisma.ga4RealtimeSnapshot.createMany({
      data: rows.map((row) => {
        const [country, pagePath, eventName] = row.dimensionValues?.map((value) => value.value ?? "") ?? [];
        return {
          siteId,
          country: country || null,
          pagePath: pagePath || null,
          eventName: eventName || null,
          activeUsers: intMetric(row.metricValues?.[0]?.value),
        };
      }),
    });
  }
}

export async function syncGoogleProviders(siteId: string) {
  const [gsc, ga4] = await Promise.all([
    syncGscSearchPerformance(siteId),
    syncGa4Traffic(siteId),
  ]);
  return [gsc, ga4];
}
