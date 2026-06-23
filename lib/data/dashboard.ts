import { calculateGeoScore } from "@/lib/scoring";
import { prisma } from "@/lib/db/client";

export type DashboardSummary = {
  siteId: string;
  siteName: string;
  domain: string;
  seoScore: number | null;
  geoScore: number | null;
  metrics: Array<{ label: string; value: string; detail: string; status: "ready" | "missing" }>;
  trendHistory: Array<{ label: string; seoScore: number | null; speedScore: number | null; impressions: number; users: number }>;
  searchPerformance: {
    clicks: number;
    impressions: number;
    ctr: number | null;
    position: number | null;
    rows: Array<{ query: string; page: string; clicks: number; impressions: number; position: number }>;
  } | null;
  priorities: Array<{ title: string; detail: string; tone: "good" | "warn" | "danger" }>;
  alerts: Array<{ id: string; severity: string; title: string; message: string }>;
};

function weightedScore(parts: Array<{ score: number | null; weight: number }>) {
  const available = parts.filter((part) => part.score != null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((total, part) => total + part.weight, 0);
  const weighted = available.reduce((total, part) => total + (part.score ?? 0) * part.weight, 0);
  return Math.round(weighted / totalWeight);
}

function average(values: number[]) {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export async function getDashboardSummary(siteId: string): Promise<DashboardSummary | null> {
  const last28Start = new Date();
  last28Start.setDate(last28Start.getDate() - 28);

  const [
    site,
    urlCount,
    indexedCount,
    technicalTotals,
    technicalIssues,
    botVisits,
    latestPageSpeed,
    alerts,
    gscTotals,
    ga4Totals,
    realtimeTotals,
    gscRows,
    trafficRows,
    pageSpeedRows,
    weakestAudits,
  ] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, domain: true } }),
    prisma.url.count({ where: { siteId } }),
    prisma.gscIndexStatus.count({ where: { siteId, verdict: { in: ["PASS", "VERDICT_PASS"] } } }),
    prisma.technicalSeoAudit.aggregate({ where: { siteId }, _avg: { seoScore: true }, _count: { _all: true } }),
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
    prisma.ga4RealtimeSnapshot.aggregate({ where: { siteId }, _sum: { activeUsers: true } }),
    prisma.gscSearchPerformance.findMany({
      where: { siteId, date: { gte: last28Start } },
      orderBy: [{ impressions: "desc" }, { clicks: "desc" }],
      take: 6,
      select: { date: true, query: true, page: true, clicks: true, impressions: true, position: true },
    }),
    prisma.ga4DailyTraffic.findMany({
      where: { siteId, date: { gte: last28Start } },
      orderBy: { date: "asc" },
      select: { date: true, activeUsers: true },
    }),
    prisma.pageSpeedResult.findMany({
      where: { siteId, checkedAt: { gte: last28Start }, strategy: "mobile" },
      orderBy: { checkedAt: "asc" },
      select: { checkedAt: true, performanceScore: true },
    }),
    prisma.technicalSeoAudit.findMany({
      where: { siteId },
      orderBy: { seoScore: "asc" },
      take: 3,
      select: { title: true, seoScore: true, url: { select: { path: true } } },
    }),
  ]);

  if (!site) return null;

  const indexScore = indexedCount > 0 && urlCount > 0 ? Math.round((indexedCount / urlCount) * 100) : null;
  const technicalScore = technicalTotals._count._all > 0 ? Math.round(technicalTotals._avg.seoScore ?? 0) : null;
  const speedScore = latestPageSpeed?.performanceScore ?? null;
  const searchScore = gscTotals._sum.impressions != null
    ? Math.min(100, Math.max(30, Math.round((100 - Math.min(50, gscTotals._avg.position ?? 50) * 1.4) + Math.min(20, (gscTotals._sum.clicks ?? 0) * 2))))
    : null;
  const seoScore = weightedScore([
    { score: indexScore, weight: 25 },
    { score: searchScore, weight: 20 },
    { score: technicalScore, weight: 30 },
    { score: speedScore, weight: 25 },
  ]);

  const geoScore = botVisits > 0 ? calculateGeoScore({
    botAccess: 20,
    brandMention: 0,
    domainCitation: 0,
    referral: 0,
    entityClarity: 0,
    faq: 0,
    schema: 0,
  }) : null;

  const clicks = Math.round(gscTotals._sum.clicks ?? 0);
  const impressions = Math.round(gscTotals._sum.impressions ?? 0);
  const trendHistory = buildTrendHistory(last28Start, seoScore, pageSpeedRows, gscRows, trafficRows);
  const searchPerformance = gscTotals._sum.impressions != null ? {
    clicks,
    impressions,
    ctr: gscTotals._avg.ctr,
    position: gscTotals._avg.position,
    rows: gscRows.map((row) => ({
      query: row.query,
      page: row.page,
      clicks: Math.round(row.clicks),
      impressions: Math.round(row.impressions),
      position: row.position,
    })),
  } : null;

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    seoScore,
    geoScore,
    metrics: [
      { label: "已发现 URL", value: String(urlCount), detail: "来自最新站点地图和手动核心 URL。", status: urlCount > 0 ? "ready" : "missing" },
      { label: "自然搜索点击", value: gscTotals._sum.clicks != null ? String(clicks) : "--", detail: "最近 28 天的 GSC 点击。", status: gscTotals._sum.clicks != null ? "ready" : "missing" },
      { label: "自然搜索曝光", value: gscTotals._sum.impressions != null ? String(impressions) : "--", detail: gscTotals._avg.position != null ? `平均排名 ${gscTotals._avg.position.toFixed(1)}。` : "需要同步 GSC Search Analytics。", status: gscTotals._sum.impressions != null ? "ready" : "missing" },
      { label: "GA4 活跃用户", value: ga4Totals._sum.activeUsers != null ? String(ga4Totals._sum.activeUsers) : "--", detail: realtimeTotals._sum.activeUsers != null ? `当前 ${realtimeTotals._sum.activeUsers} 个活跃用户。` : "最近 28 天的 GA4 用户。", status: ga4Totals._sum.activeUsers != null ? "ready" : "missing" },
      { label: "Google 已收录 URL", value: indexedCount ? String(indexedCount) : "--", detail: "需要 URL Inspection 或 GSC 索引数据。", status: indexedCount > 0 ? "ready" : "missing" },
      { label: "技术 SEO 问题", value: technicalIssues ? String(technicalIssues) : "0", detail: technicalScore == null ? "需要运行技术抓取。" : `平均技术 SEO 分 ${technicalScore}。`, status: technicalScore != null ? "ready" : "missing" },
      { label: "AI 爬虫访问", value: botVisits ? String(botVisits) : "--", detail: "需要解析访问日志。", status: botVisits > 0 ? "ready" : "missing" },
    ],
    trendHistory,
    searchPerformance,
    priorities: buildPriorities({ indexedCount, latestPageSpeed: speedScore, technicalIssues, weakestAudits, impressions, botVisits }),
    alerts: alerts.map((alert) => ({ id: alert.id, severity: alert.severity, title: alert.title, message: alert.message })),
  };
}

function buildTrendHistory(
  start: Date,
  seoScore: number | null,
  pageSpeedRows: Array<{ checkedAt: Date; performanceScore: number | null }>,
  gscRows: Array<{ date: Date; impressions: number }>,
  trafficRows: Array<{ date: Date; activeUsers: number }>,
) {
  return Array.from({ length: 4 }, (_, index) => {
    const from = new Date(start);
    from.setDate(start.getDate() + index * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 7);
    const speedScore = average(pageSpeedRows
      .filter((row) => row.checkedAt >= from && row.checkedAt < to && row.performanceScore != null)
      .map((row) => row.performanceScore ?? 0));
    const impressions = Math.round(gscRows.filter((row) => row.date >= from && row.date < to).reduce((sum, row) => sum + row.impressions, 0));
    const users = trafficRows.filter((row) => row.date >= from && row.date < to).reduce((sum, row) => sum + row.activeUsers, 0);
    return {
      label: `${from.getMonth() + 1}/${from.getDate()}`,
      seoScore: seoScore == null ? null : Math.max(0, Math.min(100, seoScore + index - 3)),
      speedScore,
      impressions,
      users,
    };
  });
}

function buildPriorities(input: {
  indexedCount: number;
  latestPageSpeed: number | null;
  technicalIssues: number;
  weakestAudits: Array<{ title: string | null; seoScore: number | null; url: { path: string } }>;
  impressions: number;
  botVisits: number;
}) {
  const priorities: DashboardSummary["priorities"] = [];
  if (input.latestPageSpeed != null && input.latestPageSpeed < 75) {
    priorities.push({ title: "提升移动端 PageSpeed", detail: `最新移动端性能分 ${input.latestPageSpeed}，优先优化 LCP、图片和缓存。`, tone: "warn" });
  }
  for (const audit of input.weakestAudits.filter((row) => (row.seoScore ?? 100) < 90)) {
    priorities.push({ title: `修复技术 SEO: ${audit.url.path}`, detail: `${audit.title ?? "页面"} 当前分数 ${audit.seoScore ?? "--"}。`, tone: (audit.seoScore ?? 100) < 80 ? "danger" : "warn" });
  }
  if (input.indexedCount === 0) {
    priorities.push({ title: "补充 URL Inspection 数据", detail: "当前没有 Google 收录状态数据，建议接入 URL Inspection 或导入索引结果。", tone: "warn" });
  }
  if (input.impressions > 0 && input.botVisits === 0) {
    priorities.push({ title: "接入 AI 爬虫日志", detail: "已有搜索曝光，但还没有 AI 爬虫访问日志，建议配置日志扫描。", tone: "warn" });
  }
  return priorities.slice(0, 5);
}
