import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const integrationSchema = z.object({
  provider: z.string().min(2),
  config: z.record(z.string(), z.unknown()),
});

const sensitiveFields = new Set([
  "apiKey",
  "bingApiKey",
  "cloudflareApiToken",
  "indexNowKey",
  "oauthClientSecret",
  "serviceAccountJson",
  "webhookSecret",
  "webhookUrl",
]);

function mergeConfig(previousConfig: Record<string, unknown>, submittedConfig: Record<string, unknown>) {
  const nextConfig = { ...previousConfig };
  for (const [key, value] of Object.entries(submittedConfig)) {
    if (value == null) {
      if (!sensitiveFields.has(key)) delete nextConfig[key];
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") {
        if (!sensitiveFields.has(key)) delete nextConfig[key];
        continue;
      }
      nextConfig[key] = trimmed;
      continue;
    }
    nextConfig[key] = value;
  }
  return nextConfig;
}

function decryptConfig(payload?: string | null) {
  if (!payload) return {};
  try {
    return decryptSecret<Record<string, unknown>>(payload);
  } catch {
    return {};
  }
}

function safeConfig(config: Record<string, unknown>) {
  const visible: Record<string, string> = {};
  const savedSensitiveFields: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(config)) {
    if (sensitiveFields.has(key)) {
      savedSensitiveFields[key] = value != null && value !== "";
    } else if (value != null) {
      visible[key] = typeof value === "string" ? value : String(value);
    }
  }
  return { visible, savedSensitiveFields };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const integrations = await prisma.integration.findMany({
    where: { siteId: id },
    select: { id: true, provider: true, status: true, lastTestedAt: true, lastError: true, updatedAt: true, configEncrypted: true },
    orderBy: { provider: "asc" },
  });
  return NextResponse.json({
    integrations: integrations.map(({ configEncrypted, ...integration }) => {
      const config = decryptConfig(configEncrypted);
      const safe = safeConfig(config);
      return { ...integration, config: safe.visible, savedSensitiveFields: safe.savedSensitiveFields };
    }),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = integrationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId: id, provider: parsed.data.provider } },
    select: { configEncrypted: true },
  });
  const previousConfig = decryptConfig(existing?.configEncrypted);
  const config = mergeConfig(previousConfig, parsed.data.config);

  const integration = await prisma.integration.upsert({
    where: { siteId_provider: { siteId: id, provider: parsed.data.provider } },
    update: {
      configEncrypted: encryptSecret(config),
      status: "CONFIGURED",
      lastError: null,
      lastTestedAt: new Date(),
    },
    create: {
      siteId: id,
      provider: parsed.data.provider,
      configEncrypted: encryptSecret(config),
      status: "CONFIGURED",
      lastTestedAt: new Date(),
    },
    select: { id: true, provider: true, status: true, lastTestedAt: true, updatedAt: true },
  });

  return NextResponse.json({ integration });
}
