import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";

const bodySchema = z.object({ email: z.email(), password: z.string().min(8) });
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "ChangeMe123!", 10);
  if (parsed.data.email !== email || !(await bcrypt.compare(parsed.data.password, hash))) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await createSession({ id: "env-admin", email, role: "OWNER" });
  return NextResponse.json({ user: { email, role: "OWNER" } });
}
