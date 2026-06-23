import { NextResponse } from "next/server";
import { getSiteUrls } from "@/lib/data/sites";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const urls = await getSiteUrls(id, 1000);
  const rows = [
    ["url", "path", "in_sitemap", "status_code", "last_crawled_at"],
    ...urls.map((url) => [url.url, url.path, url.isInSitemap, url.statusCode ?? "", url.lastCrawledAt?.toISOString() ?? ""]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="site-${id}-urls.csv"`,
    },
  });
}
