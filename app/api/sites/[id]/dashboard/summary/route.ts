import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/data/dashboard";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await getDashboardSummary(id);
  if (!summary) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json(summary);
}
