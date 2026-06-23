import { prisma } from "@/lib/db/client";
import { fetchSitemapUrls, pathFromUrl } from "@/lib/sitemap";
import { syncGoogleProviders, syncGscUrlInspection } from "@/lib/providers/google-sync";
import { createSiteAlert } from "@/lib/providers/alert-sync";
import { runPageSpeedChecks } from "@/lib/providers/pagespeed-sync";
import { submitIndexNowUrls } from "@/lib/providers/indexnow-sync";
import { runTechnicalSeoAudit } from "@/lib/providers/technical-seo-sync";
import { syncAiBotLogs } from "@/lib/providers/log-sync";
import { runGeoQueryTests } from "@/lib/providers/geo-sync";

type SyncResult = { provider: string; ok: boolean; rows: number; error?: string };

export async function syncSitemap(siteId: string) {
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
  const [google] = await Promise.all([
    syncGoogleProviders(siteId),
  ]);
  const results = [sitemap, ...google];
  await Promise.all(results
    .filter((item) => !item.ok && item.error)
    .map((item) => createSiteAlert(siteId, {
      alertType: `SYNC_${item.provider.toUpperCase()}`,
      severity: "HIGH",
      title: `${item.provider} 同步失败`,
      message: item.error ?? "同步失败。",
    }).catch(() => undefined)));
  return { results };
}

async function settle(provider: string, task: Promise<SyncResult>): Promise<SyncResult> {
  try {
    return await task;
  } catch (error) {
    return { provider, ok: false, rows: 0, error: error instanceof Error ? error.message : "Sync failed." };
  }
}

export async function syncAllSiteData(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw new Error("Site not found");

  const sitemap = await syncSitemap(siteId);
  const [google, inspection, pagespeed, indexnow, technical, logs, geo] = await Promise.all([
    syncGoogleProviders(siteId),
    settle("google-url-inspection", syncGscUrlInspection(siteId)),
    settle("pagespeed", runPageSpeedChecks(siteId)),
    settle("indexnow", submitIndexNowUrls(siteId)),
    settle("technical-seo", runTechnicalSeoAudit(siteId)),
    settle("logs", syncAiBotLogs(siteId)),
    settle("geo", runGeoQueryTests(siteId)),
  ]);

  const results = [sitemap, ...google, inspection, pagespeed, indexnow, technical, logs, geo];
  await Promise.all(results
    .filter((item) => !item.ok && item.error)
    .map((item) => createSiteAlert(siteId, {
      alertType: `SYNC_${item.provider.toUpperCase()}`,
      severity: "HIGH",
      title: `${item.provider} 同步失败`,
      message: item.error ?? "同步失败。",
    }).catch(() => undefined)));
  return { results };
}
