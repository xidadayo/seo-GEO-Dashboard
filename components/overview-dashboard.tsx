"use client";

import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Badge, EmptyState, Panel } from "@/components/ui";
import { SiteActionButton } from "@/components/site-actions";
import type { DashboardSummary } from "@/lib/data/dashboard";

function PendingScore({ label, siteId }: { label: string; siteId?: string }) {
  return <div className="flex items-center gap-4"><div className="relative grid size-[104px] place-items-center rounded-full bg-[#edf1f2]"><div className="grid size-[82px] place-items-center rounded-full bg-white"><div className="text-center"><p className="text-2xl font-semibold tracking-tight text-slate-300">--</p><p className="text-[10px] uppercase tracking-[.12em] text-slate-400">待生成</p></div></div></div><div><p className="font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">连接数据源后计算该分数。</p><a href={siteId ? `/sites/${siteId}/settings?panel=google-search-console` : "/sites/new"} className="mt-2 inline-block text-xs font-semibold text-[#168779]">配置数据源</a></div></div>;
}

export function OverviewDashboard({ summary }: { summary?: DashboardSummary | null }) {
  const metrics = summary?.metrics ?? [];
  const hasMetrics = metrics.length > 0;
  return <div className="mx-auto max-w-[1500px] animate-rise">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="text-sm text-slate-500">概览</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.03em] text-[#17212b]">{summary ? summary.siteName : "尚未连接真实数据"}</h1><p className="mt-2 text-sm text-slate-500">{summary ? `正在监控 ${summary.domain}。继续连接更多集成后，仪表盘会更完整。` : "创建站点并连接集成后，会展示 SEO、流量、PageSpeed 和 AI 可见度指标。"}</p></div>
      <div className="flex gap-2"><SiteActionButton siteId={summary?.siteId} action="sync" variant="outline">同步站点地图</SiteActionButton><SiteActionButton siteId={summary?.siteId} action="settings">配置 <ArrowUpRight /></SiteActionButton></div>
    </div>

    <div className="mt-7 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="grid gap-8 p-6 sm:grid-cols-2"><PendingScore siteId={summary?.siteId} label={`SEO 健康度${summary?.seoScore != null ? `: ${summary.seoScore}` : ""}`} /><PendingScore siteId={summary?.siteId} label={`GEO 可见度${summary?.geoScore != null ? `: ${summary.geoScore}` : ""}`} /></Panel>
      <Panel className="flex flex-col justify-between p-6">
        <div className="flex items-start justify-between"><div><p className="text-sm font-semibold">可见度脉冲</p><p className="mt-1 text-xs text-slate-500">综合信号质量</p></div><Badge tone="warn">等待数据</Badge></div>
        <div className="mt-5"><EmptyState title="暂无趋势历史" description="计划同步或手动扫描采集到真实指标后，会显示趋势图。" /></div>
      </Panel>
    </div>

    <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-[#e6ebee] bg-[#e6ebee] sm:grid-cols-2 xl:grid-cols-4">
      {(hasMetrics ? metrics : [{ label: "已发现 URL", value: "--", detail: "创建站点或抓取站点地图。", status: "missing" as const }]).map((metric) => <div key={metric.label} className="bg-white p-5"><div className="flex items-start justify-between"><p className="text-xs font-medium text-slate-500">{metric.label}</p><span className={`text-xs font-semibold ${metric.status === "ready" ? "text-[#168779]" : "text-amber-600"}`}>{metric.status === "ready" ? "已就绪" : "未配置"}</span></div><p className={`mt-3 text-3xl font-semibold tracking-[-.04em] ${metric.status === "ready" ? "text-[#17212b]" : "text-slate-300"}`}>{metric.value}</p><p className="mt-2 text-[11px] text-slate-400">{metric.detail}</p></div>)}
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
      <Panel className="p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="font-semibold">搜索表现</h2><p className="mt-1 text-xs text-slate-500">Google 点击和曝光 · 最近 28 天</p></div></div>
        <div className="mt-6"><EmptyState title="暂无 Search Console 数据" description="连接 Google Search Console 后显示真实点击、曝光、CTR 和排名趋势。" action={<SiteActionButton siteId={summary?.siteId} action="settings" target="google-search-console" variant="outline">配置 GSC</SiteActionButton>} /></div>
      </Panel>
      <Panel className="p-6">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">优先处理事项</h2><p className="mt-1 text-xs text-slate-500">由真实告警和扫描结果生成</p></div><BarChart3 className="text-[#168779]" /></div>
        <div className="mt-5"><EmptyState title="暂无待处理事项" description="抓取、PageSpeed、Search Console 和 GEO 检测完成后，会生成优化建议。" /></div>
      </Panel>
    </div>

    <Panel className="mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e6ebee] px-6 py-5"><div><h2 className="font-semibold">活跃告警</h2><p className="mt-1 text-xs text-slate-500">当前站点需要关注的问题</p></div><SiteActionButton siteId={summary?.siteId} action="alerts" variant="ghost">查看全部</SiteActionButton></div>
      {summary && summary.alerts.length > 0 ? summary.alerts.map((alert) => <div key={alert.id} className="border-b border-[#edf1f2] px-6 py-4 last:border-0"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium">{alert.title}</p><Badge tone={alert.severity === "HIGH" ? "danger" : "warn"}>{alert.severity}</Badge></div><p className="mt-1 text-xs text-slate-500">{alert.message}</p></div>) : <div className="p-6"><EmptyState title="暂无告警" description="只有真实抓取、集成、PageSpeed、流量或爬虫日志事件产生问题时，才会创建告警。" /></div>}
    </Panel>
  </div>;
}
