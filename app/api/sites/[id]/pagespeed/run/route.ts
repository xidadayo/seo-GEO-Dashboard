import { NextResponse } from "next/server";
import { z } from "zod";
import { runPageSpeedChecks } from "@/lib/providers/pagespeed-sync";

const runSchema = z.object({
  urls: z.array(z.string()).optional(),
  strategies: z.array(z.string()).optional(),
}).optional();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await runPageSpeedChecks(id, parsed.data ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
