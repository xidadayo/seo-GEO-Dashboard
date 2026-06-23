import { NextResponse } from "next/server";
import { moduleCopy } from "@/lib/content";
import { getSiteModuleData } from "@/lib/data/sites";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!moduleCopy[section]) return NextResponse.json({ error: "Unknown module section" }, { status: 404 });
  const data = await getSiteModuleData(id, section);
  return NextResponse.json({ section, data });
}
