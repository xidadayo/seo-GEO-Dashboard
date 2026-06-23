import { NextResponse } from "next/server";
import { syncSitemap } from "@/lib/sync/site-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await syncSitemap(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ imported: result.rows });
}
