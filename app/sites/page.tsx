import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { SitesList } from "@/components/sites-list";
import { listSites } from "@/lib/data/sites";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const sites = await listSites();
  return <AppShell><div className="mx-auto max-w-6xl">
    <div className="flex items-end justify-between"><div><h1 className="text-3xl font-semibold">站点</h1><p className="mt-2 text-sm text-slate-500">管理当前工作区的网站和客户项目。</p></div><Link href="/sites/new"><Button><Plus />新建站点</Button></Link></div>
    <SitesList sites={sites} />
  </div></AppShell>;
}
