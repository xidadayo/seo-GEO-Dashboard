import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
export async function GET() { const user = await readSession(); return NextResponse.json({ user }, { status: user ? 200 : 401 }); }
