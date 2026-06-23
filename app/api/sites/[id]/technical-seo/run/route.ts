import { NextResponse } from "next/server";
import { runTechnicalSeoAudit } from "@/lib/providers/technical-seo-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await runTechnicalSeoAudit(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
