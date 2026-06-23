import { subDays } from "date-fns";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN");
}

function renderReportHtml(summary: ReportSummary) {
  const items: Array<[string, string | number]> = [
    ["URL 数", summary.totals.urls],
    ["GSC 行数", summary.totals.gscRows],
    ["自然搜索点击", summary.totals.clicks],
    ["自然搜索曝光", summary.totals.impressions],
    ["GA4 行数", summary.totals.ga4Rows],
    ["活跃用户", summary.totals.activeUsers],
    ["会话数", summary.totals.sessions],
    ["浏览量", summary.totals.pageViews],
    ["PageSpeed 检测", summary.totals.pageSpeedChecks],
    ["最新移动端性能", summary.totals.latestMobilePerformance ?? "--"],
    ["GEO 测试", summary.totals.geoTests],
    ["平均 GEO 分", summary.totals.averageGeoScore ?? "--"],
    ["未处理告警", summary.totals.openAlerts],
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(summary.site.name)} SEO/GEO 28 天报告</title>
  <style>
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #17212b; background: #f4f7f8; }
    main { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
    h1 { margin: 0; font-size: 30px; }
    .muted { color: #60718a; }
    .panel { margin-top: 24px; border: 1px solid #dfe7eb; border-radius: 14px; background: #fff; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 18px; border-bottom: 1px solid #edf1f2; text-align: left; }
    th { color: #60718a; background: #f8fafb; font-size: 13px; }
    .value { font-weight: 700; }
    @media print { body { background: #fff; } main { max-width: none; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(summary.site.name)} SEO/GEO 28 天报告</h1>
    <p class="muted">${escapeHtml(summary.site.domain)} · ${formatDate(summary.period.start)} - ${formatDate(summary.period.end)}</p>
    <section class="panel">
      <table>
        <thead><tr><th>指标</th><th>数值</th></tr></thead>
        <tbody>${items.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`).join("")}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

async function writeReportFile(siteId: string, reportId: string, summary: ReportSummary) {
  const dir = path.join(process.cwd(), "public", "reports", siteId);
  await mkdir(dir, { recursive: true });
  const filename = `${reportId}.html`;
  await writeFile(path.join(dir, filename), renderReportHtml(summary), "utf8");
  return `/reports/${siteId}/${filename}`;
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
    select: { id: true },
  });
  const fileUrl = await writeReportFile(siteId, report.id, summary);
  const updatedReport = await prisma.report.update({
    where: { id: report.id },
    data: { fileUrl },
    select: { id: true, title: true, reportType: true, createdAt: true, fileUrl: true },
  });

  return { provider: "reports", ok: true, rows: 1, report: updatedReport };
}

export async function getReportHtml(siteId: string, reportId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, siteId },
    select: { summaryJson: true },
  });
  if (!report) throw new Error("Report not found");
  return renderReportHtml(report.summaryJson as unknown as ReportSummary);
}
