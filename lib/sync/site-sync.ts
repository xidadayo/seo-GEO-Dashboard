import { prisma } from "@/lib/db/client";
import { fetchSitemapUrls, pathFromUrl } from "@/lib/sitemap";
import { syncGoogleProviders, syncGscUrlInspection } from "@/lib/providers/google-sync";
import { createSiteAlert } from "@/lib/providers/alert-sync";
import { runPageSpeedChecks } from "@/lib/providers/pagespeed-sync";
import { submitIndexNowUrls } from "@/lib/providers/indexnow-sync";
import { runTechnicalSeoAudit } from "@/lib/providers/technical-seo-sync";
import { syncAiBotLogs } from "@/lib/providers/log-sync";
import { runGeoQueryTests } from "@/lib/providers/geo-sync";

type SyncResult = { provider: string; ok: boolean; rows: number; error?: string; skipped?: boolean };
const FULL_SYNC_TIMEOUT_MS = 300_000;

export async function syncSitemap(siteId: string): Promise<SyncResult> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");
  if (!site.sitemapUrl) return { provider: "sitemap", ok: false, rows: 0, error: "Site does not have sitemapUrl configured." };
  try {
    const urls = await fetchSitemapUrls(site.sitemapUrl);
    if (urls.length === 0) throw new Error("Sitemap did not return any URLs.");
    const sitemapUrlSet = new Set(urls.map((item) => item.loc));
    await prisma.url.deleteMany({
      where: { siteId: site.id, isCore: false, url: { notIn: [...sitemapUrlSet] } },
    });
    await prisma.url.updateMany({
      where: { siteId: site.id, isCore: true, url: { notIn: [...sitemapUrlSet] } },
      data: { isInSitemap: false },
    });
    const results = await Promise.all(urls.map((item) => prisma.url.upsert({
      where: { siteId_url: { siteId: site.id, url: item.loc } },
      update: { isInSitemap: true, path: pathFromUrl(item.loc) },
      create: { siteId: site.id, url: item.loc, path: pathFromUrl(item.loc), isInSitemap: true },
    })));
    return { provider: "sitemap", ok: true, rows: results.length };
  } catch (error) {
    return { provider: "sitemap", ok: false, rows: 0, error: error instanceof Error ? error.message : "Failed to fetch sitemap." };
  }
}

export async function syncSite(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw new Error("Site not found");
  const sitemap = await syncSitemap(siteId);
  const google = await settleMany("google", syncGoogleProviders(siteId));
  const results = [sitemap, ...google];
  await createAlertsForFailures(siteId, results);
  return { results };
}

export async function syncAllSiteData(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw new Error("Site not found");

  const sitemap = await syncSitemap(siteId);
  const [google, inspection, pagespeed, indexnow, technical, logs, geo] = await Promise.all([
    settleMany("google", syncGoogleProviders(siteId)),
    settle("google-url-inspection", syncGscUrlInspection(siteId)),
    settle("pagespeed", runPageSpeedChecks(siteId)),
    settle("indexnow", submitIndexNowUrls(siteId)),
    settle("technical-seo", runTechnicalSeoAudit(siteId)),
    settle("logs", syncAiBotLogs(siteId)),
    settle("geo", runGeoQueryTests(siteId)),
  ]);

  const results: SyncResult[] = [
    sitemap,
    ...google,
    inspection,
    pagespeed,
    indexnow,
    technical,
    normalizeOptionalLogsResult(logs),
    geo,
  ];
  await createAlertsForFailures(siteId, results);
  return { results };
}

async function settle(provider: string, task: Promise<SyncResult>): Promise<SyncResult> {
  try {
    return await withTimeout(provider, task);
  } catch (error) {
    return { provider, ok: false, rows: 0, error: error instanceof Error ? error.message : "Sync failed." };
  }
}

async function settleMany(provider: string, task: Promise<SyncResult[]>): Promise<SyncResult[]> {
  try {
    return await withTimeout(provider, task);
  } catch (error) {
    return [{ provider, ok: false, rows: 0, error: error instanceof Error ? error.message : "Sync failed." }];
  }
}

async function withTimeout<T>(provider: string, task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${provider} sync exceeded ${FULL_SYNC_TIMEOUT_MS / 1000}s.`)), FULL_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeOptionalLogsResult(result: SyncResult): SyncResult {
  const missingConfig = [
    "Logs integration is not configured.",
    "Log Directory is required.",
    "SSH Host, SSH User and Remote Log Path are required for server log sync.",
  ];
  if (result.provider === "logs" && result.error && missingConfig.some((message) => result.error?.includes(message))) {
    return { ...result, ok: true, skipped: true };
  }
  return result;
}

async function createAlertsForFailures(siteId: string, results: SyncResult[]) {
  await Promise.all(results
    .filter((item) => !item.ok && item.error && !item.skipped)
    .map((item) => createSiteAlert(siteId, {
      alertType: `SYNC_${item.provider.toUpperCase()}`,
      severity: "HIGH",
      title: `${item.provider} sync failed`,
      message: item.error ?? "Sync failed.",
    }).catch(() => undefined)));
}
