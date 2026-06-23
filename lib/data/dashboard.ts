import { calculateGeoScore, calculateSeoScore } from "@/lib/scoring";
import { prisma } from "@/lib/db/client";

export type DashboardSummary = {
  siteId: string;
  siteName: string;
  domain: string;
  seoScore: number | null;
  geoScore: number | null;
  metrics: Array<{ label: string; value: string; detail: string; status: "ready" | "missing" }>;
  alerts: Array<{ id: string; severity: string; title: string; message: string }>;
};

export async function getDashboardSummary(siteId: string): Promise<DashboardSummary | null> {
  const last28Start = new Date();
  last28Start.setDate(last28Start.getDate() - 28);
  const [site, urlCount, indexedCount, technicalIssues, botVisits, latestPageSpeed, alerts, gscTotals, ga4Totals, realtimeTotals] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, domain: true } }),
    prisma.url.count({ where: { siteId } }),
    prisma.gscIndexStatus.count({ where: { siteId, verdict: { in: ["PASS", "VERDICT_PASS"] } } }),
    prisma.technicalSeoAudit.count({ where: { siteId, seoScore: { lt: 80 } } }),
    prisma.aiBotLog.count({ where: { siteId } }),
    prisma.pageSpeedResult.findFirst({ where: { siteId, strategy: "mobile" }, orderBy: { checkedAt: "desc" } }),
    prisma.alert.findMany({ where: { siteId, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.gscSearchPerformance.aggregate({
      where: { siteId, date: { gte: last28Start } },
      _sum: { clicks: true, impressions: true },
      _avg: { ctr: true, position: true },
    }),
    prisma.ga4DailyTraffic.aggregate({
      where: { siteId, date: { gte: last28Start } },
      _sum: { activeUsers: true, sessions: true, pageViews: true, conversions: true },
    }),
    prisma.ga4RealtimeSnapshot.aggregate({
      where: { siteId },
      _sum: { activeUsers: true },
    }),
  ]);

  if (!site) return null;

  const hasSeoInputs = urlCount > 0 || indexedCount > 0 || technicalIssues > 0 || latestPageSpeed?.performanceScore != null;
  const seoScore = hasSeoInputs ? calculateSeoScore({
    index: urlCount > 0 ? Math.round((indexedCount / urlCount) * 25) : 0,
    keyword: 0,
    technical: technicalIssues === 0 && urlCount > 0 ? 20 : Math.max(0, 20 - technicalIssues),
    speed: latestPageSpeed?.performanceScore != null ? Math.round((latestPageSpeed.performanceScore / 100) * 15) : 0,
    content: 0,
    internalLinks: 0,
  }) : null;

  const geoScore = botVisits > 0 ? calculateGeoScore({
    botAccess: 20,
    brandMention: 0,
    domainCitation: 0,
    referral: 0,
    entityClarity: 0,
    faq: 0,
    schema: 0,
  }) : null;

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    seoScore,
    geoScore,
    metrics: [
      { label: "已发现 URL", value: String(urlCount), detail: "来自站点地图或手动录入的 URL。", status: urlCount > 0 ? "ready" : "missing" },
      { label: "自然搜索点击", value: gscTotals._sum.clicks != null ? String(Math.round(gscTotals._sum.clicks)) : "--", detail: "最近 28 天的 GSC 点击。", status: gscTotals._sum.clicks != null ? "ready" : "missing" },
      { label: "自然搜索曝光", value: gscTotals._sum.impressions != null ? String(Math.round(gscTotals._sum.impressions)) : "--", detail: gscTotals._avg.position != null ? `平均排名 ${gscTotals._avg.position.toFixed(1)}。` : "需要同步 GSC Search Analytics。", status: gscTotals._sum.impressions != null ? "ready" : "missing" },
      { label: "GA4 活跃用户", value: ga4Totals._sum.activeUsers != null ? String(ga4Totals._sum.activeUsers) : "--", detail: realtimeTotals._sum.activeUsers != null ? `当前 ${realtimeTotals._sum.activeUsers} 个活跃用户。` : "最近 28 天的 GA4 用户。", status: ga4Totals._sum.activeUsers != null ? "ready" : "missing" },
      { label: "Google 已收录 URL", value: indexedCount ? String(indexedCount) : "--", detail: "需要 URL Inspection 或 GSC 索引数据。", status: indexedCount > 0 ? "ready" : "missing" },
      { label: "技术 SEO 问题", value: technicalIssues ? String(technicalIssues) : "--", detail: "需要技术抓取结果。", status: technicalIssues > 0 ? "ready" : "missing" },
      { label: "AI 爬虫访问", value: botVisits ? String(botVisits) : "--", detail: "需要解析访问日志。", status: botVisits > 0 ? "ready" : "missing" },
    ],
    alerts: alerts.map((alert) => ({ id: alert.id, severity: alert.severity, title: alert.title, message: alert.message })),
  };
}
