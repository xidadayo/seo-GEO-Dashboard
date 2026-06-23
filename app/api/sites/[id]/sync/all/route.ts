import { NextResponse } from "next/server";
import { syncAllSiteData } from "@/lib/sync/site-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await syncAllSiteData(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Full sync failed." }, { status: 404 });
  }
}
