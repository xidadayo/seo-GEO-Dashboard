import { NextResponse } from "next/server";
import { syncGscUrlInspection } from "@/lib/providers/google-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await syncGscUrlInspection(id);
    return NextResponse.json(result, { status: result.rows > 0 ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "URL Inspection failed." }, { status: 404 });
  }
}
