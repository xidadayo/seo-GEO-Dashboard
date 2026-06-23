import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { getDashboardSummary } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function SiteOverview({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const summary = await getDashboardSummary(siteId);
  if (!summary) notFound();
  return <AppShell siteId={siteId} siteName={summary.siteName} domain={summary.domain}><OverviewDashboard summary={summary} /></AppShell>;
}
