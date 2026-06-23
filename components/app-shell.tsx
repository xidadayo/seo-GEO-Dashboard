"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, FileText, Gauge, Globe2, LayoutDashboard, Menu, Search, Settings, ShieldCheck, TimerReset, Users, X } from "lucide-react";
import { useState } from "react";
import { GlossaryLabel } from "@/components/glossary";
import { cn } from "@/lib/utils";

const nav = [
  ["概览", "overview", LayoutDashboard],
  ["SEO 索引", "seo-index", ShieldCheck],
  ["关键词", "keywords", Search],
  ["页面", "pages", FileText],
  ["技术 SEO", "technical-seo", Activity],
  ["流量", "traffic", Users],
  ["PageSpeed", "pagespeed", TimerReset],
  ["GEO 可见度", "geo-visibility", Globe2],
  ["AI 爬虫日志", "ai-bot-logs", Bot],
  ["报告", "reports", FileText],
  ["设置", "settings", Settings],
] as const;

export function AppShell({ children, siteId, siteName, domain }: { children: React.ReactNode; siteId?: string; siteName?: string; domain?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const hasSite = Boolean(siteId);

  return <div className="min-h-screen bg-[#f5f7f8]">
    <aside className={cn("fixed inset-y-0 left-0 z-30 flex w-[244px] flex-col bg-[#102a32] px-4 py-5 text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between px-2">
        <Link href="/dashboard" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#26a797]"><Gauge /><span className="sr-only">Logo</span></span><span className="text-sm font-bold leading-tight">SEO & GEO<br/><span className="font-medium text-white/60">可见度</span></span></Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="关闭导航"><X /></button>
      </div>
      <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 text-xs text-white/55"><span className="size-2 rounded-full bg-amber-300" />当前站点</div>
        <div className="mt-2"><p className="text-sm font-semibold">{siteName ?? (hasSite ? "已配置站点" : "未选择站点")}</p><p className="text-[11px] text-white/45">{domain ?? (hasSite ? "等待真实数据" : "创建站点后开始")}</p></div>
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
        {nav.map(([label, slug, Icon]) => {
          const href = hasSite ? `/sites/${siteId}/${slug}` : "/sites";
          const active = path === href || (slug === "overview" && path === "/dashboard");
          return <Link key={slug} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/62 transition hover:bg-white/7 hover:text-white", active && "bg-white/10 text-white")}><Icon className="size-[17px]" /><GlossaryLabel>{label}</GlossaryLabel></Link>;
        })}
      </nav>
      <div className="border-t border-white/10 pt-4 text-xs text-white/45">工作区<br/><span className="mt-1 block">v0.1.0 · 仅真实数据</span></div>
    </aside>
    <div className="lg:pl-[244px]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e6ebee] bg-white/95 px-5 backdrop-blur lg:px-8">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="打开导航"><Menu /></button>
        <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span className="size-2 rounded-full bg-amber-400" />数据源尚未完全配置</div>
        <div className="flex items-center gap-2">
          <button onClick={() => { window.location.href = "/sites"; }} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="搜索站点"><Search className="size-[18px]" /></button>
          <div className="ml-1 grid size-9 place-items-center rounded-full bg-[#102a32] text-xs font-bold text-white">AD</div>
        </div>
      </header>
      <main className="px-5 py-7 lg:px-8 lg:py-8">{children}</main>
    </div>
  </div>;
}
