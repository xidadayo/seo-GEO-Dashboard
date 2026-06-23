import { redirect } from "next/navigation";

const allowed = new Set([
  "google-search-console",
  "ga4",
  "pagespeed",
  "bing-indexnow",
  "ai-search",
  "logs",
]);

export default async function IntegrationSettingsPage({ params }: { params: Promise<{ siteId: string; integration: string }> }) {
  const { siteId, integration } = await params;
  redirect(`/sites/${siteId}/settings?panel=${allowed.has(integration) ? integration : "site"}`);
}
