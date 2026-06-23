import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";

export type ModuleData = Awaited<ReturnType<typeof getSiteModuleData>>;

export async function listSites() {
  return prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      domain: true,
      primaryUrl: true,
      timezone: true,
      status: true,
      _count: { select: { urls: true, integrations: true, alerts: true } },
    },
  });
}

export async function getSiteShell(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      domain: true,
      primaryUrl: true,
      sitemapUrl: true,
      robotsUrl: true,
      wordpressApiUrl: true,
      timezone: true,
      integrations: {
        where: { provider: "site-settings-extra" },
        take: 1,
        select: { configEncrypted: true },
      },
    },
  });
  if (!site) return null;
  const [metadata] = site.integrations;
  let settingsMetadata: Record<string, unknown> = {};
  try {
    settingsMetadata = metadata ? decryptSecret<Record<string, unknown>>(metadata.configEncrypted) : {};
  } catch {
    settingsMetadata = {};
  }
  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    primaryUrl: site.primaryUrl,
    sitemapUrl: site.sitemapUrl,
    robotsUrl: site.robotsUrl,
    wordpressApiUrl: site.wordpressApiUrl,
    timezone: site.timezone,
    settingsMetadata,
  };
}

export async function getSiteUrls(siteId: string, take = 50) {
  return prisma.url.findMany({
    where: { siteId },
    orderBy: [{ isCore: "desc" }, { url: "asc" }],
    take,
    select: { id: true, url: true, path: true, pageType: true, isCore: true, isInSitemap: true, statusCode: true, lastCrawledAt: true },
  });
}

export async function getGeoQueryTests(siteId: string, take = 20) {
  return prisma.geoQueryTest.findMany({
    where: { siteId },
    orderBy: { checkedAt: "desc" },
    take,
    select: {
      id: true,
      provider: true,
      query: true,
      brandMentioned: true,
      domainMentioned: true,
      citedUrl: true,
      answerSummary: true,
      score: true,
      checkedAt: true,
    },
  });
}

export async function getAiBotLogs(siteId: string, take = 50) {
  return prisma.aiBotLog.findMany({
    where: { siteId },
    orderBy: { visitedAt: "desc" },
    take,
    select: {
      id: true,
      botName: true,
      userAgent: true,
      ip: true,
      url: true,
      statusCode: true,
      referer: true,
      officialIpVerified: true,
      visitedAt: true,
    },
  });
}

export async function getSiteModuleData(siteId: string, section: string) {
  const last28Start = new Date();
  last28Start.setDate(last28Start.getDate() - 28);

  const [
    urls,
    indexStatuses,
    searchPerformance,
    keywords,
    traffic,
    realtime,
    pageSpeed,
    audits,
    botLogs,
    geoTests,
    geoScores,
    alerts,
    reports,
  ] = await Promise.all([
    section === "seo-index" || section === "pages" ? getSiteUrls(siteId, 100) : Promise.resolve([]),
    section === "seo-index" ? prisma.gscIndexStatus.findMany({
      where: { siteId },
      orderBy: { checkedAt: "desc" },
      take: 100,
      select: {
        id: true,
        verdict: true,
        coverageState: true,
        indexingState: true,
        robotsTxtState: true,
        googleCanonical: true,
        userCanonical: true,
        lastCrawlTime: true,
        checkedAt: true,
        url: { select: { url: true, path: true } },
      },
    }) : Promise.resolve([]),
    section === "keywords" || section === "pages" ? prisma.gscSearchPerformance.findMany({
      where: { siteId, date: { gte: last28Start } },
      orderBy: [{ clicks: "desc" }, { impressions: "desc" }],
      take: section === "pages" ? 200 : 100,
      select: {
        id: true,
        date: true,
        query: true,
        page: true,
        country: true,
        device: true,
        clicks: true,
        impressions: true,
        ctr: true,
        position: true,
      },
    }) : Promise.resolve([]),
    section === "keywords" ? prisma.siteKeyword.findMany({
      where: { siteId },
      orderBy: [{ priority: "desc" }, { keyword: "asc" }],
      take: 100,
      select: { id: true, keyword: true, groupName: true, priority: true, country: true, language: true, enabled: true },
    }) : Promise.resolve([]),
    section === "traffic" || section === "pages" ? prisma.ga4DailyTraffic.findMany({
      where: { siteId, date: { gte: last28Start } },
      orderBy: [{ date: "desc" }, { activeUsers: "desc" }],
      take: section === "pages" ? 200 : 100,
      select: {
        id: true,
        date: true,
        pagePath: true,
        source: true,
        medium: true,
        country: true,
        device: true,
        activeUsers: true,
        sessions: true,
        pageViews: true,
        conversions: true,
        eventCount: true,
      },
    }) : Promise.resolve([]),
    section === "traffic" ? prisma.ga4RealtimeSnapshot.findMany({
      where: { siteId },
      orderBy: { snapshotTime: "desc" },
      take: 20,
      select: { id: true, snapshotTime: true, activeUsers: true, country: true, pagePath: true, source: true, eventName: true },
    }) : Promise.resolve([]),
    section === "pagespeed" || section === "pages" ? prisma.pageSpeedResult.findMany({
      where: { siteId },
      orderBy: { checkedAt: "desc" },
      take: section === "pages" ? 200 : 100,
      select: {
        id: true,
        strategy: true,
        performanceScore: true,
        seoScore: true,
        accessibilityScore: true,
        bestPracticesScore: true,
        lcp: true,
        inp: true,
        cls: true,
        fcp: true,
        ttfb: true,
        checkedAt: true,
        url: { select: { url: true, path: true } },
      },
    }) : Promise.resolve([]),
    section === "technical-seo" || section === "pages" ? prisma.technicalSeoAudit.findMany({
      where: { siteId },
      orderBy: { checkedAt: "desc" },
      take: section === "pages" ? 200 : 100,
      select: {
        id: true,
        title: true,
        titleLength: true,
        metaDescriptionLength: true,
        h1Count: true,
        canonical: true,
        robotsMeta: true,
        imageCount: true,
        imageMissingAltCount: true,
        internalLinks: true,
        externalLinks: true,
        schemaDetected: true,
        wordCount: true,
        seoScore: true,
        checkedAt: true,
        url: { select: { url: true, path: true } },
      },
    }) : Promise.resolve([]),
    section === "ai-bot-logs" || section === "geo-visibility" || section === "pages" ? getAiBotLogs(siteId, section === "pages" ? 200 : 100) : Promise.resolve([]),
    section === "geo-visibility" ? getGeoQueryTests(siteId, 100) : Promise.resolve([]),
    section === "geo-visibility" || section === "pages" ? prisma.geoContentScore.findMany({
      where: { siteId },
      orderBy: { checkedAt: "desc" },
      take: section === "pages" ? 200 : 100,
      select: {
        id: true,
        brandClarityScore: true,
        companyEntityScore: true,
        productCoverageScore: true,
        faqScore: true,
        schemaScore: true,
        aiCitationScore: true,
        totalScore: true,
        checkedAt: true,
        url: { select: { url: true, path: true } },
      },
    }) : Promise.resolve([]),
    section === "reports" ? prisma.alert.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, alertType: true, severity: true, title: true, message: true, status: true, createdAt: true, resolvedAt: true },
    }) : Promise.resolve([]),
    section === "reports" ? prisma.report.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        reportType: true,
        title: true,
        periodStart: true,
        periodEnd: true,
        fileUrl: true,
        summaryJson: true,
        createdAt: true,
        creator: { select: { email: true, name: true } },
      },
    }) : Promise.resolve([]),
  ]);

  return {
    urls,
    indexStatuses,
    searchPerformance,
    keywords,
    traffic,
    realtime,
    pageSpeed,
    audits,
    botLogs,
    geoTests,
    geoScores,
    alerts,
    reports,
  };
}
