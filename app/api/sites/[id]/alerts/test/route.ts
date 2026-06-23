import { NextResponse } from "next/server";
import { sendTestAlert } from "@/lib/providers/alert-sync";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await sendTestAlert(id);
    const ok = Boolean(result.delivery.ok);
    return NextResponse.json(result, { status: ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Alert test failed." }, { status: 404 });
  }
}
