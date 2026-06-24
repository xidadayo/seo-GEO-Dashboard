import { readdir, readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto";

type LogsConfig = Record<string, unknown>;

type ParsedLogLine = {
  ip: string;
  visitedAt: Date;
  method: string;
  url: string;
  statusCode: number;
  referer: string | null;
  userAgent: string;
};

type LogRow = {
  siteId: string;
  botName: string;
  userAgent: string;
  ip: string | null;
  url: string;
  statusCode: number;
  referer: string | null;
  officialIpVerified: boolean;
  visitedAt: Date;
};

const execFileAsync = promisify(execFile);

const botPatterns = [
  { name: "GPTBot", pattern: /GPTBot/i },
  { name: "ChatGPT-User", pattern: /ChatGPT-User/i },
  { name: "OAI-SearchBot", pattern: /OAI-SearchBot/i },
  { name: "ClaudeBot", pattern: /ClaudeBot/i },
  { name: "Claude-User", pattern: /Claude-User/i },
  { name: "PerplexityBot", pattern: /PerplexityBot/i },
  { name: "Google-Extended", pattern: /Google-Extended/i },
  { name: "GoogleOther", pattern: /GoogleOther/i },
  { name: "Bytespider", pattern: /Bytespider/i },
  { name: "Amazonbot", pattern: /Amazonbot/i },
  { name: "Applebot", pattern: /Applebot/i },
  { name: "CCBot", pattern: /CCBot/i },
  { name: "meta-externalagent", pattern: /meta-externalagent/i },
  { name: "facebookexternalhit", pattern: /facebookexternalhit/i },
];

const monthIndex: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function windowsPathToWsl(value: string) {
  const match = value.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) return value;
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, "/")}`;
}

async function getLogsConfig(siteId: string) {
  const integration = await prisma.integration.findUnique({
    where: { siteId_provider: { siteId, provider: "logs" } },
    select: { configEncrypted: true },
  });
  if (!integration) return null;
  return decryptSecret<LogsConfig>(integration.configEncrypted);
}

async function setLogsStatus(siteId: string, ok: boolean, error?: string) {
  await prisma.integration.update({
    where: { siteId_provider: { siteId, provider: "logs" } },
    data: {
      status: ok ? "CONNECTED" : "ERROR",
      lastError: error ?? null,
      lastTestedAt: new Date(),
    },
  });
}

function parseApacheDate(value: string) {
  const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!match) return new Date();
  const [, day, month, year, hour, minute, second, zone] = match;
  const isoZone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
  return new Date(`${year}-${monthIndex[month] ?? "01"}-${day}T${hour}:${minute}:${second}${isoZone}`);
}

function parseCombinedLogLine(line: string): ParsedLogLine | null {
  const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) HTTP\/[^"]+" (\d{3}) \S+ "([^"]*)" "([^"]*)"/);
  if (!match) return null;
  const [, ip, dateText, method, url, statusCode, referer, userAgent] = match;
  return {
    ip,
    visitedAt: parseApacheDate(dateText),
    method,
    url,
    statusCode: Number(statusCode),
    referer: referer === "-" ? null : referer,
    userAgent,
  };
}

function parseJsonLogLine(line: string): ParsedLogLine | null {
  try {
    const data = JSON.parse(line) as Record<string, unknown>;
    const userAgent = asString(data.userAgent) || asString(data.ua);
    const url = asString(data.url) || asString(data.path);
    if (!userAgent || !url) return null;
    const statusCode = Number(data.statusCode ?? data.status ?? 200);
    const visitedAt = asString(data.visitedAt) || asString(data.time) || asString(data.timestamp);
    return {
      ip: asString(data.ip),
      visitedAt: visitedAt ? new Date(visitedAt) : new Date(),
      method: asString(data.method) || "GET",
      url,
      statusCode: Number.isFinite(statusCode) ? statusCode : 200,
      referer: asString(data.referer) || asString(data.referrer) || null,
      userAgent,
    };
  } catch {
    return null;
  }
}

function identifyAiBot(userAgent: string) {
  return botPatterns.find((bot) => bot.pattern.test(userAgent))?.name ?? null;
}

function identifyAiReferrer(referer: string | null | undefined) {
  if (!referer) return null;
  const lower = referer.toLowerCase();
  if (lower.includes("chatgpt.com") || lower.includes("openai.com")) return "ChatGPT Referral";
  if (lower.includes("perplexity.ai")) return "Perplexity Referral";
  if (lower.includes("claude.ai")) return "Claude Referral";
  if (lower.includes("gemini.google.com") || lower.includes("bard.google.com")) return "Gemini Referral";
  if (lower.includes("copilot.microsoft.com") || lower.includes("bing.com/chat")) return "Copilot Referral";
  if (lower.includes("you.com")) return "You.com Referral";
  return null;
}

function toAbsoluteUrl(requestUrl: string, primaryUrl: string) {
  try {
    return new URL(requestUrl, primaryUrl).toString();
  } catch {
    return requestUrl;
  }
}

async function listLogFiles(logPath: string) {
  const resolvedPath = await resolveLogPath(logPath);
  const info = await stat(/*turbopackIgnore: true*/ resolvedPath);
  if (info.isFile()) return [resolvedPath];
  if (!info.isDirectory()) throw new Error(`Log path is not a file or directory: ${logPath}`);
  const entries = await readdir(/*turbopackIgnore: true*/ resolvedPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(log|txt)$/i.test(entry.name))
    .map((entry) => path.join(resolvedPath, entry.name));
}

async function pathExists(candidate: string) {
  try {
    await stat(/*turbopackIgnore: true*/ candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveLogPath(logPath: string) {
  const candidates = [logPath];
  if (logPath.startsWith("/mnt/")) {
    const match = logPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
    if (match) candidates.push(`${match[1].toUpperCase()}:\\${match[2].replace(/\//g, "\\")}`);
  }
  if (!path.isAbsolute(logPath)) {
    candidates.push(path.join(/*turbopackIgnore: true*/ process.cwd(), logPath));
  }
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(`Log path does not exist: ${logPath}. Tried: ${candidates.join(", ")}`);
}

async function syncRemoteLogs(config: LogsConfig) {
  const host = asString(config.sshHost);
  const user = asString(config.sshUser);
  const remotePath = asString(config.remoteLogPath);
  if (!host && !user && !remotePath) return null;
  if (!host || !user || !remotePath) throw new Error("SSH Host, SSH User and Remote Log Path are required for server log sync.");

  const localSyncDir = asString(config.localSyncDir) || asString(config.logDirectory) || "D:\\real-server-logs\\nginx";
  const port = asString(config.sshPort) || "22";
  const sshKeyPath = asString(config.sshKeyPath);
  const wslLocalDir = windowsPathToWsl(localSyncDir);
  const sshParts = ["ssh", "-p", port, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"];
  if (sshKeyPath) sshParts.push("-i", windowsPathToWsl(sshKeyPath));
  const command = [
    "mkdir",
    "-p",
    shellQuote(wslLocalDir),
    "&&",
    "rsync",
    "-az",
    "--partial",
    "--append-verify",
    "-e",
    shellQuote(sshParts.join(" ")),
    shellQuote(`${user}@${host}:${remotePath}`),
    `${shellQuote(wslLocalDir)}/`,
  ].join(" ");

  try {
    await execFileAsync("wsl", ["-e", "sh", "-lc", command], { timeout: 120000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WSL rsync failed.";
    throw new Error(`Server log sync failed: ${message}`);
  }

  return localSyncDir;
}

async function fetchPublicLogText(config: LogsConfig) {
  const url = asString(config.publicLogUrl) || asString(config.logFileUrl);
  if (!url) return null;
  const response = await fetch(url, {
    headers: { "user-agent": "SEO-GEO-Dashboard/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Public log URL returned HTTP ${response.status}.`);
  return response.text();
}

function rowsFromLogText(siteId: string, primaryUrl: string, text: string) {
  const rows: LogRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseJsonLogLine(line) ?? parseCombinedLogLine(line);
    if (!parsed) continue;
    const botName = identifyAiBot(parsed.userAgent) ?? identifyAiReferrer(parsed.referer);
    if (!botName) continue;
    rows.push({
      siteId,
      botName,
      userAgent: parsed.userAgent,
      ip: parsed.ip || null,
      url: toAbsoluteUrl(parsed.url, primaryUrl),
      statusCode: parsed.statusCode,
      referer: parsed.referer,
      officialIpVerified: false,
      visitedAt: Number.isNaN(parsed.visitedAt.getTime()) ? new Date() : parsed.visitedAt,
    });
  }
  return rows;
}

export async function syncAiBotLogs(siteId: string) {
  try {
    const [site, config] = await Promise.all([
      prisma.site.findUnique({ where: { id: siteId }, select: { id: true, primaryUrl: true } }),
      getLogsConfig(siteId),
    ]);
    if (!site) throw new Error("Site not found.");
    if (!config) throw new Error("Logs integration is not configured.");
    const rows: LogRow[] = [];
    const publicLogText = await fetchPublicLogText(config);
    if (publicLogText) rows.push(...rowsFromLogText(siteId, site.primaryUrl, publicLogText));

    const syncedPath = publicLogText ? null : await syncRemoteLogs(config);
    const logPath = syncedPath || asString(config.logDirectory);
    if (!publicLogText && !logPath) throw new Error("Log Directory or Public Log URL is required.");

    const files = logPath ? await listLogFiles(logPath) : [];
    if (!publicLogText && files.length === 0) throw new Error(`No .log or .txt files found in ${logPath}.`);

    for (const file of files) {
      const text = await readFile(/*turbopackIgnore: true*/ file, "utf8");
      rows.push(...rowsFromLogText(siteId, site.primaryUrl, text));
    }

    await prisma.aiBotLog.deleteMany({ where: { siteId } });
    if (rows.length > 0) {
      await prisma.aiBotLog.createMany({ data: rows });
    }
    await setLogsStatus(siteId, true);
    return { provider: "logs", ok: true, rows: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Log scan failed.";
    await setLogsStatus(siteId, false, message).catch(() => undefined);
    return { provider: "logs", ok: false, rows: 0, error: message };
  }
}

export async function recordAiBotTrackingEvent(siteId: string, event: {
  url?: string | null;
  referer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  statusCode?: number | null;
}) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, primaryUrl: true } });
  if (!site) throw new Error("Site not found.");

  const userAgent = event.userAgent?.trim() || "unknown";
  const referer = event.referer?.trim() || null;
  const botName = identifyAiBot(userAgent) ?? identifyAiReferrer(referer);
  if (!botName) return { provider: "logs-tracking", ok: true, rows: 0 };
  const targetUrl = event.url?.trim() || site.primaryUrl;

  await prisma.aiBotLog.create({
    data: {
      siteId,
      botName,
      userAgent,
      ip: event.ip?.trim() || null,
      url: toAbsoluteUrl(targetUrl, site.primaryUrl),
      statusCode: event.statusCode ?? 200,
      referer,
      officialIpVerified: false,
      visitedAt: new Date(),
    },
  });

  return { provider: "logs-tracking", ok: true, rows: 1 };
}
