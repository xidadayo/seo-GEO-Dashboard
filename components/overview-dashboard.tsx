"use client";

import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Badge, EmptyState, Panel } from "@/components/ui";
import { GlossaryLabel } from "@/components/glossary";
import { SiteActionButton } from "@/components/site-actions";
import type { DashboardSummary } from "@/lib/data/dashboard";

function ScoreRing({ label, score, siteId }: { label: string; score?: number | null; siteId?: string }) {
  const value = score ?? 0;
  const ready = score != null;
  return <div className="flex items-center gap-4">
    <div
      className="relative grid size-[104px] place-items-center rounded-full"
      style={{ background: ready ? `conic-gradient(#168779 ${value * 3.6}deg, #edf1f2 0deg)` : "#edf1f2" }}
    >
      <div className="grid size-[82px] place-items-center rounded-full bg-white">
        <div className="text-center">
          <p className={`text-2xl font-semibold tracking-tight ${ready ? "text-[#17212b]" : "text-slate-300"}`}>{ready ? value : "--"}</p>
          <p className="text-[10px] uppercase tracking-[.12em] text-slate-400">{ready ? "READY" : "PENDING"}</p>
        </div>
      </div>
    </div>
    <div>
      <p className="font-semibold"><GlossaryLabel>{label}</GlossaryLabel>{ready ? `: ${value}` : ""}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{ready ? "基于已同步的真实数据计算。" : "连接数据源后计算该分数。"}</p>
      <a href={siteId ? `/sites/${siteId}/settings?panel=google-search-console` : "/sites/new"} className="mt-2 inline-block text-xs font-semibold text-[#168779]">配置数据源</a>
    </div>
  </div>;
}

function TrendPanel({ summary }: { summary?: DashboardSummary | null }) {
  const trends = summary?.trendHistory ?? [];
  const hasTrend = trends.some((item) => item.seoScore != null || item.speedScore != null || item.impressions > 0 || item.users > 0);
  return <Panel className="flex flex-col justify-between p-6">
    <div className="flex items-start justify-between">
      <div><p className="text-sm font-semibold"><GlossaryLabel>可见度趋势</GlossaryLabel></p><p className="mt-1 text-xs text-slate-500">SEO、速度、曝光和流量的综合变化</p></div>
      <Badge tone={hasTrend ? "good" : "warn"}>{hasTrend ? "已就绪" : "等待数据"}</Badge>
    </div>
    {hasTrend ? <div className="mt-6 grid h-[190px] grid-cols-4 items-end gap-3">
      {trends.map((item, index) => {
        const height = Math.max(8, item.seoScore ?? item.speedScore ?? Math.min(100, item.impressions * 10 + item.users * 2));
        return <div key={`${item.label}-${index}`} className="flex h-full flex-col justify-end gap-2">
          <div className="rounded-t-lg bg-[#168779]" style={{ height: `${height}%` }} />
          <div className="text-center text-[11px] text-slate-500">{item.label}</div>
        </div>;
      })}
    </div> : <div className="mt-5"><EmptyState title="暂无趋势历史" description="同步数据后会显示最近 28 天的趋势。" /></div>}
  </Panel>;
}

function SearchPerformance({ summary }: { summary?: DashboardSummary | null }) {
  const data = summary?.searchPerformance;
  if (!data) {
    return <Panel className="p-6">
      <div><h2 className="font-semibold"><GlossaryLabel>搜索表现</GlossaryLabel></h2><p className="mt-1 text-xs text-slate-500">Google 点击和曝光 · 最近 28 天</p></div>
      <div className="mt-6"><EmptyState title="暂无 Search Console 数据" description="连接 Google Search Console 后显示真实点击、曝光、CTR 和排名趋势。" action={<SiteActionButton siteId={summary?.siteId} action="settings" target="google-search-console" variant="outline">配置 GSC</SiteActionButton>} /></div>
    </Panel>;
  }
  return <Panel className="p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div><h2 className="font-semibold"><GlossaryLabel>搜索表现</GlossaryLabel></h2><p className="mt-1 text-xs text-slate-500">Google 点击和曝光 · 最近 28 天</p></div>
      <Badge tone="good">已连接</Badge>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      <MetricMini label="点击" value={String(data.clicks)} />
      <MetricMini label="曝光" value={String(data.impressions)} />
      <MetricMini label="CTR" value={data.ctr == null ? "--" : `${(data.ctr * 100).toFixed(1)}%`} />
      <MetricMini label="平均排名" value={data.position == null ? "--" : data.position.toFixed(1)} />
    </div>
    <div className="mt-5 overflow-hidden rounded-lg border border-[#edf1f2]">
      {data.rows.map((row, index) => <div key={`${row.query}-${row.page}-${index}`} className="grid gap-3 border-b border-[#edf1f2] p-3 text-sm last:border-0 md:grid-cols-[1fr_84px_84px_84px]">
        <div className="min-w-0"><p className="truncate font-medium">{row.query || "(not set)"}</p><p className="truncate text-xs text-slate-400">{row.page}</p></div>
        <p className="text-slate-600">点击 {row.clicks}</p>
        <p className="text-slate-600">曝光 {row.impressions}</p>
        <p className="text-slate-600">排名 {row.position.toFixed(1)}</p>
      </div>)}
    </div>
  </Panel>;
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[#f7f9fa] p-3"><p className="text-xs text-slate-500"><GlossaryLabel>{label}</GlossaryLabel></p><p className="mt-1 text-xl font-semibold text-[#17212b]">{value}</p></div>;
}

function Priorities({ summary }: { summary?: DashboardSummary | null }) {
  const priorities = summary?.priorities ?? [];
  return <Panel className="p-6">
    <div className="flex items-center justify-between"><div><h2 className="font-semibold"><GlossaryLabel>优先处理事项</GlossaryLabel></h2><p className="mt-1 text-xs text-slate-500">由真实告警和扫描结果生成</p></div><BarChart3 className="text-[#168779]" /></div>
    {priorities.length > 0 ? <div className="mt-5 space-y-3">
      {priorities.map((item, index) => <div key={`${item.title}-${item.detail}-${index}`} className="rounded-lg border border-[#edf1f2] p-4">
        <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p><Badge tone={item.tone}>{item.tone === "danger" ? "高" : item.tone === "warn" ? "中" : "好"}</Badge></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
      </div>)}
    </div> : <div className="mt-5"><EmptyState title="暂无待处理事项" description="抓取、PageSpeed、Search Console 和 GEO 检测完成后，会生成优化建议。" /></div>}
  </Panel>;
}

export function OverviewDashboard({ summary }: { summary?: DashboardSummary | null }) {
  const metrics = summary?.metrics ?? [];
  const hasMetrics = metrics.length > 0;
  return <div className="mx-auto max-w-[1500px] animate-rise">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-sm text-slate-500">概览</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.03em] text-[#17212b]">{summary ? summary.siteName : "尚未连接真实数据"}</h1><p className="mt-2 text-sm text-slate-500">{summary ? `正在监控 ${summary.domain}。继续连接更多集成后，仪表盘会更完整。` : "创建站点并连接集成后，会展示 SEO、流量、PageSpeed 和 AI 可见度指标。"}</p></div>
      <div className="flex gap-2"><SiteActionButton siteId={summary?.siteId} action="sync-all" variant="outline">同步全部</SiteActionButton><SiteActionButton siteId={summary?.siteId} action="settings">配置 <ArrowUpRight /></SiteActionButton></div>
    </div>

    <div className="mt-7 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="grid gap-8 p-6 sm:grid-cols-2">
        <ScoreRing siteId={summary?.siteId} label="SEO 健康度" score={summary?.seoScore} />
        <ScoreRing siteId={summary?.siteId} label="GEO 可见度" score={summary?.geoScore} />
      </Panel>
      <TrendPanel summary={summary} />
    </div>

    <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-[#e6ebee] bg-[#e6ebee] sm:grid-cols-2 xl:grid-cols-4">
      {(hasMetrics ? metrics : [{ label: "已发现 URL", value: "--", detail: "创建站点或抓取站点地图。", status: "missing" as const }]).map((metric, index) => <div key={`${metric.label}-${index}`} className="bg-white p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-slate-500"><GlossaryLabel>{metric.label}</GlossaryLabel></p><span className={`text-xs font-semibold ${metric.status === "ready" ? "text-[#168779]" : "text-amber-600"}`}>{metric.status === "ready" ? "已就绪" : "未配置"}</span></div><p className={`mt-3 text-3xl font-semibold tracking-[-.04em] ${metric.status === "ready" ? "text-[#17212b]" : "text-slate-300"}`}>{metric.value}</p><p className="mt-2 text-[11px] text-slate-400">{metric.detail}</p></div>)}
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
      <SearchPerformance summary={summary} />
      <Priorities summary={summary} />
    </div>

    <Panel className="mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e6ebee] px-6 py-5"><div><h2 className="font-semibold">活跃告警</h2><p className="mt-1 text-xs text-slate-500">当前站点需要关注的问题</p></div><SiteActionButton siteId={summary?.siteId} action="alerts" variant="ghost">查看全部</SiteActionButton></div>
      {summary && summary.alerts.length > 0 ? summary.alerts.map((alert) => <div key={alert.id} className="border-b border-[#edf1f2] px-6 py-4 last:border-0"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium">{alert.title}</p><Badge tone={alert.severity === "HIGH" ? "danger" : "warn"}>{alert.severity}</Badge></div><p className="mt-1 text-xs text-slate-500">{alert.message}</p></div>) : <div className="p-6"><EmptyState title="暂无告警" description="只有真实抓取、集成、PageSpeed、流量或爬虫日志事件产生问题时，才会创建告警。" /></div>}
    </Panel>
  </div>;
}
