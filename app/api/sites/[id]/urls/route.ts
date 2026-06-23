import { NextResponse } from "next/server";
import { getSiteUrls } from "@/lib/data/sites";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const urls = await getSiteUrls(id, 200);
  return NextResponse.json({ urls });
}
