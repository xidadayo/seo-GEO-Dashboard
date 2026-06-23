import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { listSites } from "@/lib/data/sites";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sites = await listSites();
  const firstSite = sites[0];
  if (firstSite) redirect(`/sites/${firstSite.id}/overview`);
  return <AppShell><OverviewDashboard /></AppShell>;
}
