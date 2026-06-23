import { NextResponse } from "next/server";
import { z } from "zod";
import { submitIndexNowUrls } from "@/lib/providers/indexnow-sync";

const submitSchema = z.object({
  urls: z.array(z.string().url()).optional(),
}).optional();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await submitIndexNowUrls(id, parsed.data?.urls);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "IndexNow submission failed." }, { status: 404 });
  }
}
