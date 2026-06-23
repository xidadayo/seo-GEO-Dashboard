import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";

type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

type AlertInput = {
  alertType: string;
  severity: AlertSeverity;
  title: string;
  message: string;
};

type AlertConfig = {
  alertChannel?: string;
  webhookUrl?: string;
  emailRecipients?: string;
  alertRules?: string;
  severityThreshold?: string;
};

const severityRank: Record<AlertSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSeverity(value: unknown): AlertSeverity {
  const text = asString(value).toUpperCase();
  if (text === "LOW" || text === "MEDIUM" || text === "HIGH") return text;
  if (text.includes("低")) return "LOW";
  if (text.includes("高") || text.includes("严重")) return "HIGH";
  return "MEDIUM";
}

function shouldNotify(severity: AlertSeverity, threshold: AlertSeverity) {
  return severityRank[severity] >= severityRank[threshold];
}

async function getAlertConfig(siteId: string) {
  const integration = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId, provider: "alerts" } },
    select: { configEncrypted: true },
  });
  if (!integration) return null;
  try {
    return decryptSecret<AlertConfig>(integration.configEncrypted);
  } catch {
    return null;
  }
}

async function setAlertStatus(siteId: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider: "alerts" } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  }).catch(() => undefined);
}

function bodyForChannel(channel: string, site: { name: string; domain: string }, alert: AlertInput) {
  const text = `[${alert.severity}] ${site.name} (${site.domain})\n${alert.title}\n${alert.message}`;
  const normalized = channel.toLowerCase();
  if (normalized.includes("飞书") || normalized.includes("feishu") || normalized.includes("lark")) {
    return { msg_type: "text", content: { text } };
  }
  if (normalized.includes("wecom") || normalized.includes("企业微信") || normalized.includes("wechat")) {
    return { msgtype: "text", text: { content: text } };
  }
  if (normalized.includes("slack")) {
    return { text };
  }
  if (normalized.includes("telegram")) {
    return { text };
  }
  return { site, alert, text };
}

export async function notifyAlert(siteId: string, alert: AlertInput) {
  const [site, config] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { name: true, domain: true } }),
    getAlertConfig(siteId),
  ]);
  if (!site) throw new Error("Site not found");
  if (!config) return { ok: false, skipped: true, error: "Alert integration is not configured." };

  const threshold = normalizeSeverity(config.severityThreshold);
  if (!shouldNotify(alert.severity, threshold)) {
    return { ok: true, skipped: true, reason: `Severity ${alert.severity} is below threshold ${threshold}.` };
  }

  const channel = asString(config.alertChannel) || "Webhook";
  const webhookUrl = asString(config.webhookUrl);
  if (!webhookUrl) {
    const error = channel.toLowerCase().includes("email") || channel.includes("邮件")
      ? "Email delivery needs SMTP settings; configure a Webhook/Feishu URL for automatic delivery."
      : "Webhook URL is required for alert delivery.";
    await setAlertStatus(siteId, false, error);
    return { ok: false, skipped: true, error };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyForChannel(channel, site, alert)),
    });
    const responseText = await response.text().catch(() => "");
    if (!response.ok) throw new Error(responseText || `Webhook returned HTTP ${response.status}.`);
    await setAlertStatus(siteId, true);
    return { ok: true, statusCode: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert delivery failed.";
    await setAlertStatus(siteId, false, message);
    return { ok: false, error: message };
  }
}

export async function createSiteAlert(siteId: string, alert: AlertInput) {
  const existing = await prisma.alert.findFirst({
    where: {
      siteId,
      alertType: alert.alertType,
      title: alert.title,
      status: "OPEN",
    },
    select: { id: true },
  });
  const saved = existing
    ? await prisma.alert.update({ where: { id: existing.id }, data: { severity: alert.severity, message: alert.message }, select: { id: true } })
    : await prisma.alert.create({ data: { siteId, ...alert }, select: { id: true } });
  const delivery = await notifyAlert(siteId, alert);
  return { alertId: saved.id, delivery };
}

export async function sendTestAlert(siteId: string) {
  return createSiteAlert(siteId, {
    alertType: "TEST",
    severity: "HIGH",
    title: "测试告警",
    message: "这是一条来自 SEO & GEO Dashboard 的测试告警，用于验证告警渠道配置。",
  });
}
