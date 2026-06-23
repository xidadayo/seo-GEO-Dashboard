import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";

type IndexNowConfig = {
  indexNowKey?: string;
  indexNowKeyLocationUrl?: string;
  searchEngineEndpoint?: string;
};

type SubmissionResult = {
  provider: "indexnow";
  ok: boolean;
  rows: number;
  statusCode?: number;
  endpoint?: string;
  error?: string;
};

const defaultEndpoint = "https://api.indexnow.org/indexnow";

function readConfig(payload?: string | null): IndexNowConfig | null {
  if (!payload) return null;
  try {
    return decryptSecret<IndexNowConfig>(payload);
  } catch {
    return null;
  }
}

function hostFromSiteUrl(value: string) {
  return new URL(value).host;
}

function normalizeEndpoint(value?: string) {
  if (!value?.trim()) return defaultEndpoint;
  const endpoint = value.trim();
  return endpoint.endsWith("/indexnow") ? endpoint : `${endpoint.replace(/\/+$/, "")}/indexnow`;
}

async function setIntegrationStatus(siteId: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider: "bing-indexnow" } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  });
}

async function verifyKeyFile(key: string, keyLocation: string) {
  const response = await fetch(keyLocation, { cache: "no-store" });
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`IndexNow key file returned HTTP ${response.status}.`);
  }
  if (!text.includes(key)) {
    throw new Error("IndexNow key file is reachable, but it does not contain the saved IndexNow key.");
  }
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

async function recordSubmissions(siteId: string, endpoint: string, rows: Array<{ id: string; url: string }>, status: string, statusCode?: number, responseText?: string) {
  await prisma.indexNowSubmission.createMany({
    data: rows.map((row) => ({
      siteId,
      urlId: row.id,
      url: row.url,
      endpoint,
      status,
      statusCode,
      responseText: responseText?.slice(0, 1000),
    })),
  });
}

export async function submitIndexNowUrls(siteId: string, explicitUrls?: string[]): Promise<SubmissionResult> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      primaryUrl: true,
      integrations: {
        where: { provider: "bing-indexnow" },
        take: 1,
        select: { configEncrypted: true },
      },
      urls: {
        where: explicitUrls?.length ? { url: { in: explicitUrls } } : { isInSitemap: true },
        orderBy: [{ isCore: "desc" }, { url: "asc" }],
        take: 10000,
        select: { id: true, url: true },
      },
    },
  });
  if (!site) throw new Error("Site not found");

  const [integration] = site.integrations;
  const config = readConfig(integration?.configEncrypted);
  if (!config?.indexNowKey) {
    return { provider: "indexnow", ok: false, rows: 0, error: "IndexNow Key is not configured." };
  }

  const endpoint = normalizeEndpoint(config.searchEngineEndpoint);
  const keyLocation = config.indexNowKeyLocationUrl?.trim();
  if (!keyLocation) {
    return { provider: "indexnow", ok: false, rows: 0, endpoint, error: "IndexNow key file URL is not configured." };
  }

  const rows = site.urls.length ? site.urls : [{ id: "", url: site.primaryUrl }];
  try {
    await verifyKeyFile(config.indexNowKey, keyLocation);
    const host = hostFromSiteUrl(site.primaryUrl);
    let submitted = 0;
    let lastStatusCode: number | undefined;
    for (const batch of chunk(rows, 10000)) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key: config.indexNowKey,
          keyLocation,
          urlList: batch.map((row) => row.url),
        }),
      });
      const responseText = await response.text().catch(() => "");
      lastStatusCode = response.status;
      const accepted = response.status === 200 || response.status === 202;
      await recordSubmissions(siteId, endpoint, batch.filter((row) => row.id), accepted ? "SUBMITTED" : "ERROR", response.status, responseText);
      if (!accepted) {
        throw new Error(responseText || `IndexNow returned HTTP ${response.status}.`);
      }
      submitted += batch.length;
    }
    await setIntegrationStatus(siteId, true);
    return { provider: "indexnow", ok: true, rows: submitted, statusCode: lastStatusCode, endpoint };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IndexNow submission failed.";
    if (rows.every((row) => row.id)) await recordSubmissions(siteId, endpoint, rows, "ERROR", undefined, message);
    await setIntegrationStatus(siteId, false, message).catch(() => undefined);
    return { provider: "indexnow", ok: false, rows: 0, endpoint, error: message };
  }
}
