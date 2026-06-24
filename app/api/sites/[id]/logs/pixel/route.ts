import { NextRequest, NextResponse } from "next/server";
import { recordAiBotTrackingEvent } from "@/lib/providers/log-sync";

const gif = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = request.nextUrl.searchParams.get("url");
  await recordAiBotTrackingEvent(id, {
    url,
    referer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  }).catch(() => undefined);

  return new NextResponse(gif, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store",
    },
  });
}
