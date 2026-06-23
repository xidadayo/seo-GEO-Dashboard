import { redirect } from "next/navigation";

export default async function AlertSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  redirect(`/sites/${siteId}/settings?panel=alerts`);
}
