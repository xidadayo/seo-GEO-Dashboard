import { NextResponse } from "next/server";
import { syncSite } from "@/lib/sync/site-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await syncSite(id);
    const ok = result.results.some((item) => item.ok);
    return NextResponse.json(result, { status: ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed." }, { status: 404 });
  }
}
