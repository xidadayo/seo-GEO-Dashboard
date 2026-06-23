import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "seo_geo_session";
function secret() { return new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-change-me"); }

export async function createSession(user: { id: string; email: string; role: string }) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
}

export async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}

export async function clearSession() { (await cookies()).delete(COOKIE); }
