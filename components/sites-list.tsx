"use client";

import Link from "next/link";
import { Globe2, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { PaginationControls, usePagination } from "@/components/pagination";
import type { listSites } from "@/lib/data/sites";

type SiteRow = Awaited<ReturnType<typeof listSites>>[number];

export function SitesList({ sites }: { sites: SiteRow[] }) {
  const pagination = usePagination(sites);

  return <Panel className="mt-7 p-5">{sites.length === 0 ? <EmptyState title="暂无站点" description="创建第一个站点后，开始采集 SEO、流量、PageSpeed、GEO 和爬虫日志数据。" action={<Link href="/sites/new"><Button><Plus />创建站点</Button></Link>} /> : <><div className="flex flex-col gap-2">{pagination.pageItems.map((site) => <Link key={site.id} href={`/sites/${site.id}/overview`} className="flex items-center gap-4 rounded-xl p-3 hover:bg-slate-50"><span className="grid size-12 place-items-center rounded-xl bg-[#e7f5f1] text-[#168779]"><Globe2 /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{site.name}</p><p className="mt-1 truncate text-xs text-slate-500">{site.domain} · {site.timezone} · {site._count.urls} 个 URL</p></div><Badge tone={site._count.integrations > 0 ? "good" : "warn"}>{site.status}</Badge></Link>)}</div><PaginationControls pagination={pagination} /></>}</Panel>;
}
