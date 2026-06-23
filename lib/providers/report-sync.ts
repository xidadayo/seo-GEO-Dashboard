import { subDays } from "date-fns";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/generated/prisma/client";

type ReportSummary = {
  site: { name: string; domain: string };
  period: { start: string; end: string };
  totals: {
    urls: number;
    gscRows: number;
    clicks: number;
    impressions: number;
    ga4Rows: number;
    activeUsers: number;
    sessions: number;
    pageViews: number;
    pageSpeedChecks: number;
    latestMobilePerformance: number | null;
    geoTests: number;
    averageGeoScore: number | null;
    openAlerts: number;
  };
};

function round(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 0 : Math.round(value);
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return Math.round(filtered.reduce((total, value) => total + value, 0) / filtered.length);
}

export async function generateSiteReport(siteId: string) {
  const periodEnd = new Date();
  const periodStart = subDays(periodEnd, 28);

  const [site, creator, urlCount, gscRows, gscTotals, ga4Rows, ga4Totals, pageSpeedRows, latestMobileSpeed, geoRows, geoScores, openAlerts] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, domain: true } }),
    prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.url.count({ where: { siteId } }),
    prisma.gscSearchPerformance.count({ where: { siteId, date: { gte: periodStart, lte: periodEnd } } }),
    prisma.gscSearchPerformance.aggregate({
      where: { siteId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { clicks: true, impressions: true },
    }),
    prisma.ga4DailyTraffic.count({ where: { siteId, date: { gte: periodStart, lte: periodEnd } } }),
    prisma.ga4DailyTraffic.aggregate({
      where: { siteId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { activeUsers: true, sessions: true, pageViews: true },
    }),
    prisma.pageSpeedResult.count({ where: { siteId, checkedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.pageSpeedResult.findFirst({
      where: { siteId, strategy: "mobile" },
      orderBy: { checkedAt: "desc" },
      select: { performanceScore: true },
    }),
    prisma.geoQueryTest.count({ where: { siteId, checkedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.geoQueryTest.findMany({ where: { siteId, checkedAt: { gte: periodStart, lte: periodEnd } }, select: { score: true } }),
    prisma.alert.count({ where: { siteId, status: "OPEN" } }),
  ]);

  if (!site) throw new Error("Site not found");
  if (!creator) throw new Error("No user exists to assign as report creator.");

  const summary: ReportSummary = {
    site: { name: site.name, domain: site.domain },
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    totals: {
      urls: urlCount,
      gscRows,
      clicks: round(gscTotals._sum.clicks),
      impressions: round(gscTotals._sum.impressions),
      ga4Rows,
      activeUsers: round(ga4Totals._sum.activeUsers),
      sessions: round(ga4Totals._sum.sessions),
      pageViews: round(ga4Totals._sum.pageViews),
      pageSpeedChecks: pageSpeedRows,
      latestMobilePerformance: latestMobileSpeed?.performanceScore ?? null,
      geoTests: geoRows,
      averageGeoScore: average(geoScores.map((row) => row.score)),
      openAlerts,
    },
  };

  const report = await prisma.report.create({
    data: {
      siteId,
      reportType: "SEO_GEO_28D",
      title: `${site.name} SEO/GEO 28 天报告`,
      periodStart,
      periodEnd,
      summaryJson: summary as unknown as Prisma.InputJsonValue,
      createdBy: creator.id,
    },
    select: { id: true, title: true, reportType: true, createdAt: true },
  });

  return { provider: "reports", ok: true, rows: 1, report };
}
