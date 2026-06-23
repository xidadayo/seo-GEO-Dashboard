import { NextResponse } from "next/server";
import { runGeoQueryTests } from "@/lib/providers/geo-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await runGeoQueryTests(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
