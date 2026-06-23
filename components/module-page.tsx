"use client";

import { Filter, Settings2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { moduleCopy } from "@/lib/content";
import { Badge, Button, EmptyState, Input, Panel } from "@/components/ui";
import { GlossaryLabel } from "@/components/glossary";
import { SiteActionButton } from "@/components/site-actions";
import { PaginationControls, usePagination } from "@/components/pagination";
import type { getSiteModuleData } from "@/lib/data/sites";

type ModuleData = Awaited<ReturnType<typeof getSiteModuleData>>;
type UrlRow = ModuleData["urls"][number];
type GeoTestRow = ModuleData["geoTests"][number];
type BotLogRow = ModuleData["botLogs"][number];
type SiteSettings = {
  id: string;
  name: string;
  domain: string;
  primaryUrl: string;
  sitemapUrl: string | null;
  robotsUrl: string | null;
  wordpressApiUrl: string | null;
  timezone: string;
  settingsMetadata?: Record<string, unknown>;
};

type IntegrationState = {
  config: Record<string, string>;
  savedSensitiveFields: Record<string, boolean>;
  status?: string;
  lastError?: string | null;
  lastTestedAt?: string | null;
};

export function ModulePage({ section, siteId, site, moduleData }: { section: string; siteId?: string; site?: SiteSettings | null; moduleData: ModuleData }) {
  const copy = moduleCopy[section] ?? moduleCopy.settings;
  const isSettings = section === "settings";
  const isGeo = section === "geo-visibility";
  const isBotLogs = section === "ai-bot-logs";
  const isReports = section === "reports";
  const isTechnicalSeo = section === "technical-seo";
  const isPageSpeed = section === "pagespeed";
  const isSeoIndex = section === "seo-index";
  const primaryAction = isSettings ? "settings" : isGeo ? "geo" : isBotLogs ? "logs" : isReports ? "report" : isTechnicalSeo ? "technical" : isPageSpeed ? "pagespeed" : isSeoIndex ? "gsc-inspect" : "sync";
  const primaryLabel = isSettings ? "\u6dfb\u52a0\u96c6\u6210" : isGeo ? "\u8fd0\u884c GEO \u6d4b\u8bd5" : isBotLogs ? "\u626b\u63cf\u65e5\u5fd7" : isReports ? "\u751f\u6210\u62a5\u544a" : isTechnicalSeo ? "\u8fd0\u884c\u6293\u53d6" : isPageSpeed ? "\u68c0\u6d4b PageSpeed" : isSeoIndex ? "\u68c0\u67e5\u7d22\u5f15" : "\u540c\u6b65\u6570\u636e";
  const summary = isSettings ? buildSettingsSummary(site ?? null) : buildModuleSummary(section, moduleData);
  return <div className="mx-auto max-w-[1500px] animate-rise">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-semibold tracking-[-.03em]"><GlossaryLabel>{copy.title}</GlossaryLabel></h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{copy.description}</p></div><div className="flex flex-wrap gap-2"><SiteActionButton siteId={siteId} action="export" variant="outline">导出 URL</SiteActionButton>{!isSettings ? <SiteActionButton siteId={siteId} action="sync-all" variant="outline">同步全部</SiteActionButton> : null}{isSeoIndex ? <SiteActionButton siteId={siteId} action="indexnow" variant="outline">提交 IndexNow</SiteActionButton> : null}<SiteActionButton siteId={siteId} action={primaryAction} target={isSettings ? "google-search-console" : undefined}>{primaryLabel}</SiteActionButton></div></div>
    <div className="mt-7 grid gap-4 md:grid-cols-[.72fr_1.28fr]">
      <Panel className="p-6"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">当前数值</p><p className={`mt-4 text-5xl font-semibold tracking-[-.05em] ${summary.ready ? "text-[#17212b]" : "text-slate-300"}`}>{summary.value}</p><p className="mt-3 text-sm text-slate-500">{summary.detail}</p><div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100">{summary.ready ? <div className="h-full bg-[#168779]" style={{ width: `${summary.progress}%` }} /> : null}</div></Panel>
      <Panel className="p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">数据就绪状态</h2><p className="mt-1 text-xs text-slate-500">当前模块的集成和同步状态</p></div><Badge tone={summary.ready ? "good" : "warn"}>{summary.ready ? "已就绪" : "暂无记录"}</Badge></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{summary.items.map((item) => <div key={item.label} className="rounded-xl bg-[#f7f9fa] p-4"><p className="text-xs text-slate-500"><GlossaryLabel>{item.label}</GlossaryLabel></p><p className="mt-2 text-sm font-semibold text-slate-500">{item.value}</p></div>)}</div><p className="mt-5 text-xs leading-5 text-slate-500">这里只展示真实服务商结果和已保存的站点配置。</p></Panel>
    </div>
    {isSettings ? <SettingsForm site={site ?? null} /> : <ModuleDataView section={section} siteId={siteId} data={moduleData} emptyTitle={copy.emptyTitle} emptyDescription={copy.emptyDescription} />}
  </div>;
}

function ModuleDataView({ section, siteId, data, emptyTitle, emptyDescription }: { section: string; siteId?: string; data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  if (section === "seo-index") return <SeoIndexTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "keywords") return <KeywordTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "pages") return <PagesTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "technical-seo") return <TechnicalSeoTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "traffic") return <TrafficTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "pagespeed") return <PageSpeedTable data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  if (section === "geo-visibility") return <><GeoTestTable tests={data.geoTests} /><GeoContentScoreTable data={data} /></>;
  if (section === "ai-bot-logs") return <BotLogTable logs={data.botLogs} />;
  if (section === "reports") return <ReportsTable siteId={siteId} data={data} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
  return <DataTable title={emptyTitle} description={emptyDescription} urls={[]} />;
}

function buildSettingsSummary(site: SiteSettings | null) {
  const configured = [
    site?.primaryUrl,
    site?.sitemapUrl,
    site?.robotsUrl,
    site?.wordpressApiUrl,
    site?.timezone,
  ].filter(Boolean).length;

  return {
    value: site ? String(configured) : "--",
    detail: site ? "已保存站点基础配置，集成状态在下方表单中展示。" : "等待保存站点配置",
    ready: Boolean(site),
    progress: site ? Math.min(100, configured * 20) : 0,
    items: [
      { label: "数据源连接", value: site ? "已创建站点" : "--" },
      { label: "站点地图", value: site?.sitemapUrl ? "已配置" : "--" },
      { label: "主 URL", value: site?.primaryUrl ?? "--" },
    ],
  };
}

function buildModuleSummary(section: string, data: ModuleData) {
  const avgGeo = average(data.geoTests.map((row) => row.score));
  const avgContentGeo = average(data.geoScores.map((row) => row.totalScore));
  const avgPageSpeed = average(data.pageSpeed.map((row) => row.performanceScore ?? 0).filter(Boolean));
  const avgTechnical = average(data.audits.map((row) => row.seoScore ?? 0).filter(Boolean));
  const clicks = Math.round(sum(data.searchPerformance.map((row) => row.clicks)));
  const impressions = Math.round(sum(data.searchPerformance.map((row) => row.impressions)));
  const users = sum(data.traffic.map((row) => row.activeUsers));
  const sessions = sum(data.traffic.map((row) => row.sessions));
  const pageViews = sum(data.traffic.map((row) => row.pageViews));
  const openAlerts = data.alerts.filter((row) => row.status === "OPEN").length;
  const indexed = data.indexStatuses.filter((row) => isPositiveIndexStatus(row.verdict, row.coverageState, row.indexingState)).length;
  const latest = latestDate([
    ...data.indexStatuses.map((row) => row.checkedAt),
    ...data.searchPerformance.map((row) => row.date),
    ...data.traffic.map((row) => row.date),
    ...data.realtime.map((row) => row.snapshotTime),
    ...data.pageSpeed.map((row) => row.checkedAt),
    ...data.audits.map((row) => row.checkedAt),
    ...data.botLogs.map((row) => row.visitedAt),
    ...data.geoTests.map((row) => row.checkedAt),
    ...data.geoScores.map((row) => row.checkedAt),
    ...data.reports.map((row) => row.createdAt),
    ...data.indexNowSubmissions.map((row) => row.submittedAt),
  ]);

  const summaries: Record<string, { value: string; detail: string; ready: boolean; progress: number; items: Array<{ label: string; value: string }> }> = {
    "seo-index": {
      value: data.indexStatuses.length ? `${indexed}/${data.indexStatuses.length}` : data.indexNowSubmissions.length ? String(data.indexNowSubmissions.length) : String(data.urls.length || "--"),
      detail: data.indexStatuses.length ? "来自已保存 GSC 索引检查的已收录 URL" : data.indexNowSubmissions.length ? "来自 IndexNow 的 URL 提交记录" : "已有站点地图 URL 记录，索引检查待执行",
      ready: data.indexStatuses.length > 0 || data.indexNowSubmissions.length > 0 || data.urls.length > 0,
      progress: data.indexStatuses.length ? Math.round((indexed / data.indexStatuses.length) * 100) : data.indexNowSubmissions.length ? 100 : Math.min(100, data.urls.length * 4),
      items: [
        { label: "URL 记录", value: String(data.urls.length || "--") },
        { label: "索引检查", value: String(data.indexStatuses.length || "--") },
        { label: "IndexNow 提交", value: String(data.indexNowSubmissions.length || "--") },
      ],
    },
    keywords: {
      value: clicks ? String(clicks) : "--",
      detail: "来自已保存 GSC 查询行的自然搜索点击",
      ready: data.searchPerformance.length > 0 || data.keywords.length > 0,
      progress: Math.min(100, data.searchPerformance.length),
      items: [
        { label: "GSC 行数", value: String(data.searchPerformance.length || "--") },
        { label: "曝光量", value: impressions ? String(impressions) : "--" },
        { label: "已配置关键词", value: String(data.keywords.length || "--") },
      ],
    },
    pages: {
      value: String(data.urls.length || "--"),
      detail: "按页面汇总站点地图、GSC、GA4、PageSpeed 和 GEO 数据",
      ready: data.urls.length > 0 || data.searchPerformance.length > 0 || data.traffic.length > 0,
      progress: Math.min(100, data.urls.length * 4),
      items: [
        { label: "URL 数", value: String(data.urls.length || "--") },
        { label: "GSC 行数", value: String(data.searchPerformance.length || "--") },
        { label: "GA4 行数", value: String(data.traffic.length || "--") },
      ],
    },
    "technical-seo": {
      value: avgTechnical == null ? "--" : String(avgTechnical),
      detail: "来自已保存技术抓取审计的平均 SEO 分数",
      ready: data.audits.length > 0,
      progress: avgTechnical ?? 0,
      items: [
        { label: "审计行数", value: String(data.audits.length || "--") },
        { label: "问题数", value: String(data.audits.filter((row) => (row.seoScore ?? 100) < 80).length || "--") },
        { label: "最近抓取", value: formatDate(latest) },
      ],
    },
    traffic: {
      value: users ? String(users) : "--",
      detail: "来自已保存 GA4 日数据和实时数据的活跃用户",
      ready: data.traffic.length > 0 || data.realtime.length > 0,
      progress: Math.min(100, data.traffic.length + data.realtime.length),
      items: [
        { label: "会话数", value: sessions ? String(sessions) : "--" },
        { label: "浏览量", value: pageViews ? String(pageViews) : "--" },
        { label: "实时行数", value: String(data.realtime.length || "--") },
      ],
    },
    pagespeed: {
      value: avgPageSpeed == null ? "--" : String(avgPageSpeed),
      detail: "Lighthouse 平均性能分数",
      ready: data.pageSpeed.length > 0,
      progress: avgPageSpeed ?? 0,
      items: [
        { label: "检测次数", value: String(data.pageSpeed.length || "--") },
        { label: "移动端", value: String(data.pageSpeed.filter((row) => row.strategy === "mobile").length || "--") },
        { label: "最近检查", value: formatDate(latest) },
      ],
    },
    "geo-visibility": {
      value: avgGeo == null && avgContentGeo == null ? "--" : String(avgGeo ?? avgContentGeo),
      detail: data.geoTests.length ? "来自已保存服务商测试的 AI 可见度平均分" : "有内容 GEO 评分时会在此展示",
      ready: data.geoTests.length > 0 || data.geoScores.length > 0,
      progress: avgGeo ?? avgContentGeo ?? 0,
      items: [
        { label: "服务商测试", value: String(data.geoTests.length || "--") },
        { label: "内容评分", value: String(data.geoScores.length || "--") },
        { label: "最近检查", value: formatDate(latest) },
      ],
    },
    "ai-bot-logs": {
      value: String(data.botLogs.length || "--"),
      detail: "从访问日志解析出的 AI 爬虫访问",
      ready: data.botLogs.length > 0,
      progress: data.botLogs.length > 0 ? 100 : 0,
      items: [
        { label: "爬虫访问", value: String(data.botLogs.length || "--") },
        { label: "不同爬虫", value: String(new Set(data.botLogs.map((row) => row.botName)).size || "--") },
        { label: "最近访问", value: formatDate(latest) },
      ],
    },
    reports: {
      value: String(data.reports.length || "--"),
      detail: "已保存的报告文件和生成的告警",
      ready: data.reports.length > 0 || data.alerts.length > 0,
      progress: data.reports.length > 0 ? 100 : Math.min(100, data.alerts.length * 20),
      items: [
        { label: "报告数", value: String(data.reports.length || "--") },
        { label: "未处理告警", value: String(openAlerts || "--") },
        { label: "最新项目", value: formatDate(latest) },
      ],
    },
  };

  return summaries[section] ?? { value: "--", detail: "等待真实数据", ready: false, progress: 0, items: [{ label: "数据源连接", value: "--" }, { label: "最近同步", value: "--" }, { label: "下次计划", value: "--" }] };
}

function DataTable({ title, description, urls }: { title: string; description: string; urls: UrlRow[] }) {
  const [sitemapOnly, setSitemapOnly] = useState(false);
  const visibleUrls = sitemapOnly ? urls.filter((url) => url.isInSitemap) : urls;
  const pagination = usePagination(visibleUrls);
  return <Panel className="mt-4 overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-[#e6ebee] p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">表现明细</h2><p className="mt-1 text-xs text-slate-500">此表来自已保存的站点记录。</p></div><Button variant={sitemapOnly ? "primary" : "outline"} onClick={() => setSitemapOnly((value) => !value)}><Filter />{sitemapOnly ? "显示全部" : "仅看站点地图内"}</Button></div>{visibleUrls.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "路径", "在站点地图中", "状态", "最近抓取"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="max-w-[360px] truncate px-5 py-4 font-medium">{row.url}</td><td className="px-5 py-4 text-slate-500">{row.path}</td><td className="px-5 py-4"><Badge tone={row.isInSitemap ? "good" : "warn"}>{row.isInSitemap ? "是" : "否"}</Badge></td><td className="px-5 py-4">{row.statusCode ?? "--"}</td><td className="px-5 py-4 text-slate-500">{row.lastCrawledAt ? row.lastCrawledAt.toISOString() : "--"}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></> : <div className="p-6"><EmptyState title={title} description={description} /></div>}</Panel>;
}

function SeoIndexTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const pagination = usePagination(data.indexStatuses);
  if (data.indexStatuses.length === 0 && data.indexNowSubmissions.length === 0) return <><IndexNowSubmissionTable submissions={data.indexNowSubmissions} /><DataTable title={emptyTitle} description={emptyDescription} urls={data.urls} /></>;
  return <>
    {data.indexStatuses.length > 0 ? <Panel className="mt-4 overflow-hidden"><TableHeader title="索引覆盖" description="按 URL 保存的 Google 索引检查记录。" count={`${data.indexStatuses.length} 次检查`} /><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "结论", "覆盖状态", "索引状态", "Robots", "最近抓取", "检查时间"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2] align-top"><td className="max-w-[320px] truncate px-5 py-4 font-medium">{row.url.url}</td><td className="px-5 py-4"><Badge tone={isPositiveIndexStatus(row.verdict, row.coverageState, row.indexingState) ? "good" : "warn"}>{row.verdict ?? "--"}</Badge></td><td className="px-5 py-4 text-slate-600">{row.coverageState ?? "--"}</td><td className="px-5 py-4 text-slate-600">{row.indexingState ?? "--"}</td><td className="px-5 py-4 text-slate-600">{row.robotsTxtState ?? "--"}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.lastCrawlTime)}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.checkedAt)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel> : null}
    <IndexNowSubmissionTable submissions={data.indexNowSubmissions} />
    {data.urls.length > 0 ? <DataTable title={emptyTitle} description={emptyDescription} urls={data.urls} /> : null}
  </>;
}

function IndexNowSubmissionTable({ submissions }: { submissions: ModuleData["indexNowSubmissions"] }) {
  const pagination = usePagination(submissions);
  if (submissions.length === 0) return <Panel className="mt-4 p-6"><EmptyState title="暂无 IndexNow 提交记录" description="在 Bing / IndexNow 集成中保存配置后，点击同步数据或提交 IndexNow，会把站点地图 URL 提交给搜索引擎并在这里记录结果。" /></Panel>;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="IndexNow 提交记录" description="提交给 Bing / IndexNow 端点的 URL 和响应状态。" count={`${submissions.length} 条记录`} /><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "路径", "状态", "HTTP", "搜索引擎端点", "响应", "提交时间"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2] align-top"><td className="max-w-[320px] truncate px-5 py-4 font-medium">{row.url}</td><td className="px-5 py-4 text-slate-500">{row.urlRecord?.path ?? "--"}</td><td className="px-5 py-4"><Badge tone={row.status === "SUBMITTED" ? "good" : "warn"}>{row.status}</Badge></td><td className="px-5 py-4 text-slate-600">{row.statusCode ?? "--"}</td><td className="max-w-[220px] truncate px-5 py-4 text-slate-500">{row.endpoint}</td><td className="max-w-[280px] truncate px-5 py-4 text-xs text-slate-500">{row.responseText ?? "--"}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.submittedAt)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel>;
}

function KeywordTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const pagination = usePagination(data.searchPerformance);
  const keywordPagination = usePagination(data.keywords, 20);
  if (data.searchPerformance.length === 0 && data.keywords.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="关键词表现" description="GSC 查询行，包含点击、曝光、CTR 和排名。" count={`${data.searchPerformance.length} 行`} />{data.searchPerformance.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["查询词", "页面", "点击", "曝光", "CTR", "排名", "国家/地区", "设备", "日期"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="max-w-[240px] px-5 py-4 font-medium">{row.query || "（未设置）"}</td><td className="max-w-[280px] truncate px-5 py-4 text-slate-600">{row.page}</td><td className="px-5 py-4">{Math.round(row.clicks)}</td><td className="px-5 py-4">{Math.round(row.impressions)}</td><td className="px-5 py-4">{formatPercent(row.ctr)}</td><td className="px-5 py-4">{row.position ? row.position.toFixed(1) : "--"}</td><td className="px-5 py-4 text-slate-500">{row.country ?? "--"}</td><td className="px-5 py-4 text-slate-500">{row.device ?? "--"}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.date)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></> : null}{data.keywords.length > 0 ? <div className="border-t border-[#edf1f2]"><div className="p-5"><h3 className="text-sm font-semibold">已配置关键词目标</h3><div className="mt-3 flex flex-wrap gap-2">{keywordPagination.pageItems.map((row) => <Badge key={row.id} tone={row.enabled ? "neutral" : "warn"}>{row.keyword}</Badge>)}</div></div><PaginationControls pagination={keywordPagination} /></div> : null}</Panel>;
}

function PagesTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const rows = data.urls.map((url) => {
    const searchRows = data.searchPerformance.filter((row) => row.page === url.url || row.page.endsWith(url.path));
    const trafficRows = data.traffic.filter((row) => row.pagePath === url.path || row.pagePath === url.url);
    const latestSpeed = data.pageSpeed.find((row) => row.url.url === url.url);
    const latestAudit = data.audits.find((row) => row.url.url === url.url);
    const latestGeo = data.geoScores.find((row) => row.url.url === url.url);
    return {
      ...url,
      clicks: Math.round(sum(searchRows.map((row) => row.clicks))),
      impressions: Math.round(sum(searchRows.map((row) => row.impressions))),
      users: sum(trafficRows.map((row) => row.activeUsers)),
      speed: latestSpeed?.performanceScore,
      seo: latestAudit?.seoScore,
      geo: latestGeo?.totalScore,
    };
  });
  const pagination = usePagination(rows);
  if (rows.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="页面表现" description="每个 URL 一行，合并 GSC、GA4、PageSpeed、技术 SEO 和 GEO 信号。" count={`${rows.length} 个页面`} /><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "状态", "点击", "曝光", "用户", "速度", "SEO", "GEO", "站点地图"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="max-w-[340px] truncate px-5 py-4 font-medium">{row.url}</td><td className="px-5 py-4">{row.statusCode ?? "--"}</td><td className="px-5 py-4">{row.clicks || "--"}</td><td className="px-5 py-4">{row.impressions || "--"}</td><td className="px-5 py-4">{row.users || "--"}</td><td className="px-5 py-4">{scoreBadge(row.speed)}</td><td className="px-5 py-4">{scoreBadge(row.seo)}</td><td className="px-5 py-4">{scoreBadge(row.geo)}</td><td className="px-5 py-4"><Badge tone={row.isInSitemap ? "good" : "warn"}>{row.isInSitemap ? "是" : "否"}</Badge></td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel>;
}

function TechnicalSeoTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const pagination = usePagination(data.audits);
  if (data.audits.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="技术 SEO 审计" description="已保存的标题、Meta、标题层级、结构化数据、链接和内容抓取检查。" count={`${data.audits.length} 次审计`} /><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "分数", "标题", "Meta 长度", "H1", "缺少 Alt 图片", "链接", "结构化数据", "检查时间"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2] align-top"><td className="max-w-[300px] truncate px-5 py-4 font-medium">{row.url.url}</td><td className="px-5 py-4">{scoreBadge(row.seoScore)}</td><td className="max-w-[240px] px-5 py-4 text-slate-600">{row.title ?? "--"}</td><td className="px-5 py-4">{row.metaDescriptionLength ?? "--"}</td><td className="px-5 py-4">{row.h1Count ?? "--"}</td><td className="px-5 py-4">{row.imageMissingAltCount ?? "--"}</td><td className="px-5 py-4">{(row.internalLinks ?? 0) + (row.externalLinks ?? 0) || "--"}</td><td className="px-5 py-4"><Badge tone={row.schemaDetected ? "good" : "warn"}>{row.schemaDetected ? "是" : "否"}</Badge></td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.checkedAt)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel>;
}

function TrafficTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const pagination = usePagination(data.traffic);
  const realtimePagination = usePagination(data.realtime, 6);
  if (data.traffic.length === 0 && data.realtime.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="流量分析" description="来自已保存同步的 GA4 日数据和实时快照。" count={`${data.traffic.length} 条日数据`} />{data.traffic.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["日期", "页面", "来源 / 媒介", "用户", "会话", "浏览量", "转化", "国家/地区", "设备"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.date)}</td><td className="max-w-[260px] truncate px-5 py-4 font-medium">{row.pagePath ?? "--"}</td><td className="px-5 py-4 text-slate-600">{[row.source, row.medium].filter(Boolean).join(" / ") || "--"}</td><td className="px-5 py-4">{row.activeUsers}</td><td className="px-5 py-4">{row.sessions}</td><td className="px-5 py-4">{row.pageViews}</td><td className="px-5 py-4">{row.conversions}</td><td className="px-5 py-4 text-slate-500">{row.country ?? "--"}</td><td className="px-5 py-4 text-slate-500">{row.device ?? "--"}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></> : null}{data.realtime.length > 0 ? <div className="border-t border-[#edf1f2]"><div className="p-5"><h3 className="text-sm font-semibold">实时快照</h3><div className="mt-3 grid gap-3 md:grid-cols-3">{realtimePagination.pageItems.map((row) => <div key={row.id} className="rounded-lg bg-[#f7f9fa] p-3"><p className="text-xl font-semibold">{row.activeUsers}</p><p className="mt-1 text-xs text-slate-500">{row.pagePath ?? row.eventName ?? row.source ?? "实时"} · {formatDate(row.snapshotTime)}</p></div>)}</div></div><PaginationControls pagination={realtimePagination} /></div> : null}</Panel>;
}

function PageSpeedTable({ data, emptyTitle, emptyDescription }: { data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const pagination = usePagination(data.pageSpeed);
  if (data.pageSpeed.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="PageSpeed 检测" description="按 URL 和策略展示 Lighthouse 分数与 Core Web Vitals。" count={`${data.pageSpeed.length} 次检测`} /><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "策略", "性能", "SEO", "可访问性", "最佳实践", "LCP", "INP", "CLS", "检查时间"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="max-w-[300px] truncate px-5 py-4 font-medium">{row.url.url}</td><td className="px-5 py-4 text-slate-600">{row.strategy}</td><td className="px-5 py-4">{scoreBadge(row.performanceScore)}</td><td className="px-5 py-4">{scoreBadge(row.seoScore)}</td><td className="px-5 py-4">{scoreBadge(row.accessibilityScore)}</td><td className="px-5 py-4">{scoreBadge(row.bestPracticesScore)}</td><td className="px-5 py-4">{formatMetric(row.lcp, "s")}</td><td className="px-5 py-4">{formatMetric(row.inp, "ms")}</td><td className="px-5 py-4">{formatMetric(row.cls)}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.checkedAt)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel>;
}

function GeoContentScoreTable({ data }: { data: ModuleData }) {
  const pagination = usePagination(data.geoScores);
  if (data.geoScores.length === 0) return null;
  return <Panel className="mt-4 overflow-hidden"><TableHeader title="GEO 内容评分" description="页面级实体、结构化数据、FAQ 和引用准备度。" count={`${data.geoScores.length} 条评分`} /><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["URL", "总分", "品牌", "实体", "产品", "FAQ", "结构化数据", "引用", "检查时间"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="max-w-[300px] truncate px-5 py-4 font-medium">{row.url.url}</td><td className="px-5 py-4">{scoreBadge(row.totalScore)}</td><td className="px-5 py-4">{row.brandClarityScore}</td><td className="px-5 py-4">{row.companyEntityScore}</td><td className="px-5 py-4">{row.productCoverageScore}</td><td className="px-5 py-4">{row.faqScore}</td><td className="px-5 py-4">{row.schemaScore}</td><td className="px-5 py-4">{row.aiCitationScore}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.checkedAt)}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></Panel>;
}

function ReportsTable({ siteId, data, emptyTitle, emptyDescription }: { siteId?: string; data: ModuleData; emptyTitle: string; emptyDescription: string }) {
  const reportPagination = usePagination(data.reports);
  const alertPagination = usePagination(data.alerts);
  if (data.reports.length === 0 && data.alerts.length === 0) return <EmptyPanel title={emptyTitle} description={emptyDescription} />;
  return <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Panel className="overflow-hidden"><TableHeader title="报告" description="已生成的报告记录和可下载文件。" count={`${data.reports.length} 份报告`} />{data.reports.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["标题", "类型", "周期", "创建人", "创建时间", "文件"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{reportPagination.pageItems.map((row) => <tr key={row.id} className="border-t border-[#edf1f2]"><td className="px-5 py-4 font-medium">{row.title}</td><td className="px-5 py-4 text-slate-600">{row.reportType}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.periodStart)} - {formatDate(row.periodEnd)}</td><td className="px-5 py-4 text-slate-600">{row.creator.name ?? row.creator.email}</td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(row.createdAt)}</td><td className="px-5 py-4">{siteId ? <a className="font-semibold text-[#168779]" href={row.fileUrl ?? `/api/sites/${siteId}/reports/${row.id}/download`}>下载</a> : "--"}</td></tr>)}</tbody></table></div><PaginationControls pagination={reportPagination} /></> : <div className="p-6"><EmptyState title={emptyTitle} description={emptyDescription} /></div>}</Panel><Panel className="overflow-hidden"><TableHeader title="告警" description="扫描产生的未处理和历史告警。" count={`${data.alerts.length} 条告警`} />{data.alerts.length > 0 ? <>{alertPagination.pageItems.map((row) => <div key={row.id} className="border-t border-[#edf1f2] p-5"><div className="flex items-start justify-between gap-3"><p className="font-medium">{row.title}</p><Badge tone={row.severity === "HIGH" ? "danger" : row.status === "OPEN" ? "warn" : "neutral"}>{row.severity}</Badge></div><p className="mt-1 text-xs text-slate-500">{row.message}</p><p className="mt-3 text-xs text-slate-400">{row.status} · {formatDate(row.createdAt)}</p></div>)}<PaginationControls pagination={alertPagination} /></> : <div className="p-6"><EmptyState title="暂无告警" description="扫描生成真实问题后，告警会显示在这里。" /></div>}</Panel></div>;
}

function GeoTestTable({ tests }: { tests: GeoTestRow[] }) {
  const pagination = usePagination(tests);
  return <Panel className="mt-4 overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-[#e6ebee] p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">AI 可见度测试结果</h2><p className="mt-1 text-xs text-slate-500">来自已配置 AI 搜索服务商的保存结果。</p></div><Badge tone={tests.length > 0 ? "good" : "warn"}>{tests.length > 0 ? `${tests.length} 次测试` : "暂无测试"}</Badge></div>{tests.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["服务商", "查询", "信号", "分数", "检查时间", "摘要"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((test) => <tr key={test.id} className="border-t border-[#edf1f2] align-top"><td className="px-5 py-4 font-medium">{test.provider}</td><td className="max-w-[260px] px-5 py-4 text-slate-600">{test.query}</td><td className="px-5 py-4"><div className="flex flex-col gap-2"><Badge tone={test.brandMentioned ? "good" : "warn"}>{test.brandMentioned ? "提到品牌" : "未提到品牌"}</Badge><Badge tone={test.domainMentioned ? "good" : "warn"}>{test.domainMentioned ? "提到域名" : "未提到域名"}</Badge>{test.citedUrl ? <a className="text-xs font-semibold text-[#168779]" href={test.citedUrl} target="_blank" rel="noreferrer">引用 URL</a> : null}</div></td><td className="px-5 py-4 font-semibold">{test.score}</td><td className="px-5 py-4 text-xs text-slate-500">{test.checkedAt.toLocaleString()}</td><td className="max-w-[360px] px-5 py-4 text-slate-600">{test.answerSummary ?? "--"}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></> : <div className="p-6"><EmptyState title="暂无 GEO 测试" description="配置 AI 搜索服务商后运行 GEO 测试，记录品牌提及、域名引用和答案摘要。" /></div>}</Panel>;
}

function BotLogTable({ logs }: { logs: BotLogRow[] }) {
  const pagination = usePagination(logs);
  return <Panel className="mt-4 overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-[#e6ebee] p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">AI 爬虫访问</h2><p className="mt-1 text-xs text-slate-500">从已保存的访问日志配置中解析。</p></div><Badge tone={logs.length > 0 ? "good" : "warn"}>{logs.length > 0 ? `${logs.length} 次访问` : "暂无访问"}</Badge></div>{logs.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[#f8fafb] text-xs uppercase tracking-wide text-slate-400"><tr>{["爬虫", "URL", "状态", "IP", "验证", "访问时间", "User Agent"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold"><GlossaryLabel>{heading}</GlossaryLabel></th>)}</tr></thead><tbody>{pagination.pageItems.map((log) => <tr key={log.id} className="border-t border-[#edf1f2] align-top"><td className="px-5 py-4 font-medium">{log.botName}</td><td className="max-w-[300px] truncate px-5 py-4 text-slate-600">{log.url}</td><td className="px-5 py-4"><Badge tone={log.statusCode >= 200 && log.statusCode < 400 ? "good" : "warn"}>{log.statusCode}</Badge></td><td className="px-5 py-4 text-slate-600">{log.ip ?? "--"}</td><td className="px-5 py-4"><Badge tone={log.officialIpVerified ? "good" : "neutral"}>{log.officialIpVerified ? "已验证" : "未验证"}</Badge></td><td className="px-5 py-4 text-xs text-slate-500">{log.visitedAt.toLocaleString()}</td><td className="max-w-[360px] px-5 py-4 text-xs text-slate-500">{log.userAgent}</td></tr>)}</tbody></table></div><PaginationControls pagination={pagination} /></> : <div className="p-6"><EmptyState title="暂无爬虫日志" description="配置日志后运行扫描，从 nginx 或 Apache combined access log 解析 AI 爬虫访问。" /></div>}</Panel>;
}

function TableHeader({ title, description, count }: { title: string; description: string; count: string }) {
  return <div className="flex flex-col justify-between gap-3 border-b border-[#e6ebee] p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold"><GlossaryLabel>{title}</GlossaryLabel></h2><p className="mt-1 text-xs text-slate-500">{description}</p></div><Badge tone="neutral">{count}</Badge></div>;
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return <Panel className="mt-4 p-6"><EmptyState title={title} description={description} /></Panel>;
}

function scoreBadge(value: number | null | undefined) {
  if (value == null) return "--";
  return <Badge tone={value >= 80 ? "good" : value >= 50 ? "warn" : "danger"}>{value}</Badge>;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return null;
  return Math.round(sum(usable) / usable.length);
}

function latestDate(values: Array<Date | null | undefined>) {
  const timestamps = values.map((value) => value ? new Date(value).getTime() : 0).filter(Boolean);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function formatMetric(value: number | null | undefined, suffix = "") {
  if (value == null) return "--";
  return `${Number(value).toFixed(suffix === "ms" ? 0 : 2)}${suffix}`;
}

function isPositiveIndexStatus(verdict?: string | null, coverageState?: string | null, indexingState?: string | null) {
  const text = `${verdict ?? ""} ${coverageState ?? ""} ${indexingState ?? ""}`.toLowerCase();
  return text.includes("pass") || text.includes("indexed") || text.includes("submitted and indexed");
}

function SettingsForm({ site }: { site: SiteSettings | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel") ?? "site";
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Record<string, IntegrationState>>({});
  const metadata = site?.settingsMetadata ?? {};
  const metadataValue = (key: string) => (typeof metadata[key] === "string" ? metadata[key] as string : "");

  useEffect(() => {
    const activeSiteId = site?.id;
    if (!activeSiteId) return;
    let cancelled = false;
    async function loadIntegrations() {
      const response = await fetch(`/api/sites/${activeSiteId}/integrations`);
      if (!response.ok) return;
      const result = await response.json();
      if (cancelled) return;
      setIntegrations(Object.fromEntries((result.integrations ?? []).map((integration: { provider: string; config?: Record<string, string>; savedSensitiveFields?: Record<string, boolean>; status?: string; lastError?: string | null; lastTestedAt?: string | null }) => [
        integration.provider,
        {
          config: integration.config ?? {},
          savedSensitiveFields: integration.savedSensitiveFields ?? {},
          status: integration.status,
          lastError: integration.lastError,
          lastTestedAt: integration.lastTestedAt,
        },
      ])));
    }
    loadIntegrations();
    return () => {
      cancelled = true;
    };
  }, [site?.id]);

  function selectPanel(panelId: string) {
    router.push(panelId === "site" ? pathname : `${pathname}?panel=${panelId}`, { scroll: false });
  }

  async function saveSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site) return;
    setSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "保存设置失败。");
      setMessage("设置已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存设置失败。");
    } finally {
      setSaving(false);
    }
  }

  async function saveIntegration(event: FormEvent<HTMLFormElement>, provider: string) {
    event.preventDefault();
    if (!site) return;
    setSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const config = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/sites/${site.id}/integrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, config }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "保存集成失败。");
      const refreshed = await fetch(`/api/sites/${site.id}/integrations`);
      if (refreshed.ok) {
        const refreshedResult = await refreshed.json();
        setIntegrations(Object.fromEntries((refreshedResult.integrations ?? []).map((integration: { provider: string; config?: Record<string, string>; savedSensitiveFields?: Record<string, boolean>; status?: string; lastError?: string | null; lastTestedAt?: string | null }) => [
          integration.provider,
          {
            config: integration.config ?? {},
            savedSensitiveFields: integration.savedSensitiveFields ?? {},
            status: integration.status,
            lastError: integration.lastError,
            lastTestedAt: integration.lastTestedAt,
          },
        ])));
      }
      setMessage(`${providerLabel(provider)} 已安全保存。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存集成失败。");
    } finally {
      setSaving(false);
    }
  }

  return <Panel className="mt-4 overflow-hidden">
    <div className="border-b border-[#e6ebee] p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e7f5f1] text-[#168779]"><Settings2 /></span><div><h2 className="font-semibold">设置 / 集成</h2><p className="mt-1 text-xs text-slate-500">凭据保存前会加密，保存后不会明文显示。</p></div></div></div>
    <div className="grid lg:grid-cols-[260px_1fr]">
      <nav className="border-b border-[#e6ebee] p-3 lg:border-b-0 lg:border-r">{settingsPanels.map((item) => <button key={item.id} type="button" onClick={() => selectPanel(item.id)} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium ${panel === item.id ? "bg-[#e7f5f1] text-[#168779]" : "text-slate-600 hover:bg-slate-50"}`}>{item.label}</button>)}</nav>
      <div className="p-6">
        {panel === "site" ? <form onSubmit={saveSite}><SectionTitle title="站点设置" description="基础站点身份、发现 URL 和目标市场信息。" /><div className="mt-6 grid gap-5 md:grid-cols-2"><Input label="站点名称" name="name" defaultValue={site?.name} placeholder="你的网站名称" required /><Input label="域名" name="domain" defaultValue={site?.domain} placeholder="example.com" required /><Input label="主 URL" name="primaryUrl" defaultValue={site?.primaryUrl} placeholder="https://example.com" required /><Input label="站点地图 URL" name="sitemapUrl" defaultValue={site?.sitemapUrl ?? ""} placeholder="https://example.com/sitemap.xml" /><Input label="Robots.txt URL" name="robotsUrl" defaultValue={site?.robotsUrl ?? ""} placeholder="https://example.com/robots.txt" /><Input label="WordPress REST API 基础 URL" name="wordpressApiUrl" defaultValue={site?.wordpressApiUrl ?? ""} placeholder="https://example.com/wp-json" /><Input label="时区" name="timezone" defaultValue={site?.timezone ?? "UTC"} placeholder="UTC" /><Input label="默认国家/地区" name="defaultCountry" defaultValue={metadataValue("defaultCountry")} placeholder="US" /><Input label="目标市场" name="targetMarkets" defaultValue={metadataValue("targetMarkets")} placeholder="US, UK, EU" /><Input label="品牌名称" name="brandNames" defaultValue={metadataValue("brandNames")} placeholder="品牌别名，逗号分隔" /><Input label="公司名称" name="companyNames" defaultValue={metadataValue("companyNames")} placeholder="公司/法律主体名称" /><Input label="域名别名" name="domainAliases" defaultValue={metadataValue("domainAliases")} placeholder="example.com, www.example.com" /><Input label="目标关键词" name="targetKeywords" defaultValue={metadataValue("targetKeywords")} placeholder="关键词列表" /><Input label="竞争对手" name="competitors" defaultValue={metadataValue("competitors")} placeholder="竞争对手域名" /><Input label="页面类型" name="pageTypes" defaultValue={metadataValue("pageTypes")} placeholder="首页, 产品页, 博客, 联系页" /></div><SaveBar saving={saving} message={message} /></form> : null}
        {panel === "google-search-console" ? <IntegrationForm key={`google-search-console-${JSON.stringify(integrations["google-search-console"] ?? {})}`} integration={integrations["google-search-console"]} provider="google-search-console" title="Google Search Console" description="基于 OAuth 或服务账号的 Search Console 和 URL Inspection 访问。" onSubmit={saveIntegration} saving={saving} message={message} fields={gscFields} /> : null}
        {panel === "ga4" ? <IntegrationForm key={`ga4-${JSON.stringify(integrations.ga4 ?? {})}`} integration={integrations.ga4} provider="ga4" title="GA4" description="Analytics 属性、实时指标和转化事件映射。" onSubmit={saveIntegration} saving={saving} message={message} fields={ga4Fields} /> : null}
        {panel === "pagespeed" ? <IntegrationForm key={`pagespeed-${JSON.stringify(integrations.pagespeed ?? {})}`} integration={integrations.pagespeed} provider="pagespeed" title="PageSpeed API" description="移动端和桌面端的 Core Web Vitals 与 Lighthouse 检测。" onSubmit={saveIntegration} saving={saving} message={message} fields={pagespeedFields} /> : null}
        {panel === "bing-indexnow" ? <IntegrationForm key={`bing-indexnow-${JSON.stringify(integrations["bing-indexnow"] ?? {})}`} integration={integrations["bing-indexnow"]} provider="bing-indexnow" siteId={site?.id} title="Bing / IndexNow" description="Bing Webmaster 和 IndexNow 提交设置。" onSubmit={saveIntegration} saving={saving} message={message} fields={bingFields} /> : null}
        {panel === "ai-search" ? <IntegrationForm key={`ai-search-${JSON.stringify(integrations["ai-search"] ?? {})}`} integration={integrations["ai-search"]} provider="ai-search" title="AI 搜索服务商" description="用于 AI 可见度测试的服务商适配配置。" onSubmit={saveIntegration} saving={saving} message={message} fields={aiFields} /> : null}
        {panel === "logs" ? <IntegrationForm key={`logs-${JSON.stringify(integrations.logs ?? {})}`} integration={integrations.logs} provider="logs" title="日志" description="访问日志上传、挂载目录、Cloudflare 或 Webhook 配置。" onSubmit={saveIntegration} saving={saving} message={message} fields={logFields} /> : null}
        {panel === "alerts" ? <IntegrationForm key={`alerts-${JSON.stringify(integrations.alerts ?? {})}`} integration={integrations.alerts} provider="alerts" siteId={site?.id} title="告警" description="邮件和 Webhook 告警渠道，以及严重程度阈值。" onSubmit={saveIntegration} saving={saving} message={message} fields={alertFields} /> : null}
        {panel === "sharing" ? <IntegrationForm key={`sharing-${JSON.stringify(integrations.sharing ?? {})}`} integration={integrations.sharing} provider="sharing" title="分享" description="只读仪表盘/报告分享和 API Token 权限限制。" onSubmit={saveIntegration} saving={saving} message={message} fields={sharingFields} /> : null}
      </div>
    </div>
  </Panel>;
}

const settingsPanels = [
  { id: "site", label: "站点设置" },
  { id: "google-search-console", label: "Google Search Console" },
  { id: "ga4", label: "GA4" },
  { id: "pagespeed", label: "PageSpeed API" },
  { id: "bing-indexnow", label: "Bing / IndexNow" },
  { id: "ai-search", label: "AI 搜索服务商" },
  { id: "logs", label: "日志" },
  { id: "alerts", label: "告警" },
  { id: "sharing", label: "分享" },
];

type Field = { name: string; label: string; placeholder?: string; type?: string; sensitive?: boolean };

const gscFields: Field[] = [
  { name: "authMethod", label: "认证方式", placeholder: "OAuth 或 Service Account" },
  { name: "gscProperty", label: "GSC 资源", placeholder: "sc-domain:example.com" },
  { name: "siteUrl", label: "站点 URL", placeholder: "https://example.com" },
  { name: "scopes", label: "授权范围", placeholder: "webmasters.readonly, webmasters" },
  { name: "inspectionUrlLimit", label: "URL Inspection 数量", placeholder: "默认 50，最多 200" },
  { name: "serviceAccountJson", label: "服务账号 JSON", placeholder: "粘贴 JSON，保存时加密", sensitive: true },
  { name: "oauthClientId", label: "OAuth Client ID" },
  { name: "oauthClientSecret", label: "OAuth Client Secret", type: "password", sensitive: true },
];
const ga4Fields: Field[] = [
  { name: "propertyId", label: "GA4 Property ID" },
  { name: "authMethod", label: "认证方式", placeholder: "OAuth 或 Service Account" },
  { name: "serviceAccountJson", label: "服务账号 JSON", placeholder: "粘贴 JSON，保存时加密", sensitive: true },
  { name: "realtimeEnabled", label: "启用实时数据", placeholder: "true / false" },
  { name: "conversionEvents", label: "转化事件" },
  { name: "inquiryEvents", label: "询盘事件" },
  { name: "whatsappEventName", label: "WhatsApp 事件名" },
  { name: "emailClickEventName", label: "邮件点击事件名" },
  { name: "formSubmitEventName", label: "表单提交事件名" },
];
const pagespeedFields: Field[] = [
  { name: "apiKey", label: "API Key", type: "password", sensitive: true },
  { name: "defaultStrategy", label: "默认策略", placeholder: "mobile / desktop / both" },
  { name: "checkFrequency", label: "检测频率", placeholder: "daily / weekly" },
  { name: "coreUrls", label: "核心 URL" },
];
const bingFields: Field[] = [
  { name: "bingApiKey", label: "Bing Webmaster API Key", type: "password", sensitive: true },
  { name: "indexNowKey", label: "IndexNow Key", type: "password", sensitive: true },
  { name: "indexNowKeyLocationUrl", label: "IndexNow Key 文件 URL" },
  { name: "autoSubmitUpdatedUrls", label: "自动提交更新 URL", placeholder: "true / false" },
  { name: "searchEngineEndpoint", label: "搜索引擎端点" },
];
const aiFields: Field[] = [
  { name: "providerName", label: "服务商名称", placeholder: "OpenAI / Perplexity / DeepSeek / Manual" },
  { name: "providerType", label: "服务商类型", placeholder: "OpenAI / Perplexity / Manual / Custom" },
  { name: "apiKey", label: "API Key", type: "password", sensitive: true },
  { name: "model", label: "模型 / 搜索模式" },
  { name: "baseUrl", label: "API 基础 URL", placeholder: "https://api.deepseek.com/chat/completions" },
  { name: "testQueries", label: "测试查询", placeholder: "每行一个查询，或用逗号分隔" },
  { name: "dailyQueryLimit", label: "每日查询上限" },
  { name: "monthlyBudgetLimit", label: "月预算上限" },
  { name: "timeout", label: "超时时间" },
  { name: "enabled", label: "启用", placeholder: "true / false" },
];
const logFields: Field[] = [
  { name: "sourceType", label: "日志来源类型", placeholder: "文件上传 / 挂载目录 / Cloudflare / Webhook" },
  { name: "logFormat", label: "日志格式", placeholder: "nginx combined / apache combined / custom" },
  { name: "logDirectory", label: "日志目录" },
  { name: "sshHost", label: "SSH Host", placeholder: "185.xxx.xxx.xxx or server.example.com" },
  { name: "sshUser", label: "SSH User", placeholder: "root or u123456789" },
  { name: "sshPort", label: "SSH Port", placeholder: "22 or 65002" },
  { name: "remoteLogPath", label: "服务器日志路径", placeholder: "/var/log/nginx/access.log*" },
  { name: "localSyncDir", label: "本地同步目录", placeholder: "D:\\real-server-logs\\nginx" },
  { name: "sshKeyPath", label: "SSH 密钥路径", placeholder: "C:\\Users\\36553\\.ssh\\id_ed25519" },
  { name: "cloudflareApiToken", label: "Cloudflare API Token", type: "password", sensitive: true },
  { name: "zoneId", label: "Zone ID" },
  { name: "webhookSecret", label: "Webhook Secret", type: "password", sensitive: true },
];
const alertFields: Field[] = [
  { name: "alertChannel", label: "告警渠道", placeholder: "Email / Feishu / WeCom / Slack / Telegram" },
  { name: "webhookUrl", label: "Webhook URL", type: "password", sensitive: true },
  { name: "emailRecipients", label: "邮件接收人" },
  { name: "alertRules", label: "告警规则" },
  { name: "severityThreshold", label: "严重程度阈值" },
];
const sharingFields: Field[] = [
  { name: "dashboardSharing", label: "仪表盘分享", placeholder: "enabled / disabled" },
  { name: "reportSharing", label: "报告分享", placeholder: "enabled / disabled" },
  { name: "defaultExpiryDays", label: "默认过期天数" },
  { name: "passwordRequired", label: "是否需要密码", placeholder: "true / false" },
  { name: "apiTokenScopes", label: "API Token 权限范围", placeholder: "dashboard, keywords, pages, reports" },
];

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-lg font-semibold"><GlossaryLabel>{title}</GlossaryLabel></h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}

function IntegrationForm({ provider, siteId, title, description, fields, onSubmit, saving, message, integration }: { provider: string; siteId?: string; title: string; description: string; fields: Field[]; onSubmit: (event: FormEvent<HTMLFormElement>, provider: string) => void; saving: boolean; message: string | null; integration?: IntegrationState }) {
  return <form onSubmit={(event) => onSubmit(event, provider)}><SectionTitle title={title} description={description} /><IntegrationStatus integration={integration} /><div className="mt-6 grid gap-5 md:grid-cols-2">{fields.map((field) => {
    const hasSavedSensitiveValue = field.sensitive && integration?.savedSensitiveFields[field.name];
    return <Input key={field.name} label={field.label} name={field.name} type={field.type ?? "text"} defaultValue={field.sensitive ? "" : integration?.config[field.name] ?? ""} placeholder={hasSavedSensitiveValue ? "已安全保存，留空则保留现有值。" : field.placeholder} />;
  })}</div>{siteId && provider === "alerts" ? <div className="mt-5 flex justify-start gap-2">
    <SiteActionButton siteId={siteId} action="alert-test" variant="outline">发送测试告警</SiteActionButton>
  </div> : null}<SaveBar saving={saving} message={message} /></form>;
}

function IntegrationStatus({ integration }: { integration?: IntegrationState }) {
  if (!integration?.status) return null;
  const ok = integration.status === "CONNECTED";
  return <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${ok ? "bg-[#e7f5f1] text-[#168779]" : integration.status === "ERROR" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
    <p className="font-semibold">状态：{integration.status}</p>
    {integration.lastTestedAt ? <p className="mt-1 text-xs">最近检查：{new Date(integration.lastTestedAt).toLocaleString()}</p> : null}
    {integration.lastError ? <p className="mt-1 text-xs leading-5">{integration.lastError}</p> : null}
  </div>;
}

function SaveBar({ saving, message }: { saving: boolean; message: string | null }) {
  return <><p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">API Key、OAuth 密钥、服务账号 JSON 等敏感字段会在保存前加密，保存后不会再次明文显示。</p>{message ? <p className="mt-3 rounded-lg bg-[#e7f5f1] px-3 py-2 text-sm text-[#168779]">{message}</p> : null}<div className="mt-6 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "保存中..." : "保存更改"}</Button></div></>;
}

function providerLabel(provider: string) {
  return settingsPanels.find((item) => item.id === provider)?.label ?? provider;
}
