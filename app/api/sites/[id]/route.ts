import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

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
}).passthrough();

function sanitizeConfig(config: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== "" && value != null));
}

function decryptConfig(payload?: string | null) {
  if (!payload) return {};
  try {
    return decryptSecret<Record<string, unknown>>(payload);
  } catch {
    return {};
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: { integrations: { where: { provider: "site-settings-extra" }, take: 1 } },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const [metadata] = site.integrations;
  const siteFields = {
    id: site.id,
    workspaceId: site.workspaceId,
    name: site.name,
    domain: site.domain,
    primaryUrl: site.primaryUrl,
    sitemapUrl: site.sitemapUrl,
    robotsUrl: site.robotsUrl,
    wordpressApiUrl: site.wordpressApiUrl,
    timezone: site.timezone,
    status: site.status,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
  return NextResponse.json({ site: { ...siteFields, settingsMetadata: decryptConfig(metadata?.configEncrypted) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = siteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, domain, primaryUrl, sitemapUrl, robotsUrl, wordpressApiUrl, timezone, ...metadata } = parsed.data;
  const cleanMetadata = sanitizeConfig(metadata);

  try {
    const site = await prisma.site.update({
      where: { id },
      data: {
        name,
        domain,
        primaryUrl,
        sitemapUrl: sitemapUrl || null,
        robotsUrl: robotsUrl || null,
        wordpressApiUrl: wordpressApiUrl || null,
        timezone,
      },
    });
    if (Object.keys(cleanMetadata).length > 0) {
      await prisma.integration.upsert({
        where: { siteId_provider: { siteId: id, provider: "site-settings-extra" } },
        update: { configEncrypted: encryptSecret(cleanMetadata), status: "CONFIGURED", lastError: null },
        create: { siteId: id, provider: "site-settings-extra", configEncrypted: encryptSecret(cleanMetadata), status: "CONFIGURED" },
      });
    }
    return NextResponse.json({ site });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: { message: "This domain already exists in the workspace." } }, { status: 409 });
    }
    throw error;
  }
}
