import { NextResponse } from "next/server";
import { getReportHtml } from "@/lib/providers/report-sync";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await params;
  try {
    const html = await getReportHtml(id, reportId);
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${reportId}.html"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report not found." }, { status: 404 });
  }
}
