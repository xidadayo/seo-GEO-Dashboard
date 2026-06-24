import { NextRequest, NextResponse } from "next/server";
import { recordAiBotTrackingEvent } from "@/lib/providers/log-sync";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await recordAiBotTrackingEvent(id, {
    url: typeof body.url === "string" ? body.url : request.headers.get("origin"),
    referer: typeof body.referer === "string" ? body.referer : request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json(result, { headers: corsHeaders });
}
