import { NextResponse } from "next/server";
import { z } from "zod";
import { SiteStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { ensurePrimaryWorkspace } from "@/lib/db/workspace";

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  try {
    const parsed = new URL(normalizeUrl(trimmed) as string);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

const siteSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3).transform(normalizeDomain),
  primaryUrl: z.preprocess(normalizeUrl, z.url()),
  sitemapUrl: z.preprocess(normalizeUrl, z.url().optional().or(z.literal(""))),
  robotsUrl: z.preprocess(normalizeUrl, z.url().optional().or(z.literal(""))),
  wordpressApiUrl: z.preprocess(normalizeUrl, z.url().optional().or(z.literal(""))),
  timezone: z.string().default("UTC"),
});

export async function GET() {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, domain: true, primaryUrl: true, sitemapUrl: true, timezone: true, status: true },
  });
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  const parsed = siteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const workspace = await ensurePrimaryWorkspace();
  try {
    const site = await prisma.site.create({
      data: {
        workspaceId: workspace.id,
        name: parsed.data.name,
        domain: parsed.data.domain,
        primaryUrl: parsed.data.primaryUrl,
        sitemapUrl: parsed.data.sitemapUrl || null,
        robotsUrl: parsed.data.robotsUrl || null,
        wordpressApiUrl: parsed.data.wordpressApiUrl || null,
        timezone: parsed.data.timezone,
        status: SiteStatus.ACTIVE,
      },
    });

    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: { message: "This domain already exists in the workspace." } }, { status: 409 });
    }
    throw error;
  }
}
