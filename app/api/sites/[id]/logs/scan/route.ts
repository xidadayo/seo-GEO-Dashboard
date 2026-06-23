import { NextResponse } from "next/server";
import { syncAiBotLogs } from "@/lib/providers/log-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await syncAiBotLogs(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
