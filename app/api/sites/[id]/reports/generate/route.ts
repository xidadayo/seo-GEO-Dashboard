import { NextResponse } from "next/server";
import { generateSiteReport } from "@/lib/providers/report-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await generateSiteReport(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ provider: "reports", ok: false, rows: 0, error: error instanceof Error ? error.message : "Report generation failed." }, { status: 502 });
  }
}
