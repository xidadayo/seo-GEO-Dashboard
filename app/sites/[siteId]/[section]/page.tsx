import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { moduleCopy } from "@/lib/content";
import { getSiteModuleData, getSiteShell } from "@/lib/data/sites";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ siteId: string; section: string }> }) {
  const { siteId, section } = await params;
  if (!moduleCopy[section]) notFound();
  const [site, moduleData] = await Promise.all([
    getSiteShell(siteId),
    getSiteModuleData(siteId, section),
  ]);
  if (!site) notFound();
  return <AppShell siteId={siteId} siteName={site.name} domain={site.domain}><ModulePage section={section} siteId={siteId} site={site} moduleData={moduleData} /></AppShell>;
}
