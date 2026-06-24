"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Play, RefreshCw, Settings2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui";

type Action = "sync" | "sync-all" | "settings" | "export" | "health" | "alerts" | "geo" | "logs" | "report" | "technical" | "indexnow" | "alert-test" | "pagespeed" | "gsc-inspect";
type IntegrationTarget = "google-search-console" | "ga4" | "pagespeed" | "bing-indexnow" | "ai-search" | "logs" | "alerts" | "sharing";
type ResultItem = { provider: string; ok: boolean; error?: string; skipped?: boolean };
type ActionResult = { results?: ResultItem[] };

export function SiteActionButton({
  siteId,
  action,
  variant = "primary",
  children,
  target,
}: {
  siteId?: string;
  action: Action;
  target?: IntegrationTarget;
  variant?: "primary" | "outline" | "ghost";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const href = hrefFor(action, siteId, target);

  if (href) {
    return <a href={href} className={buttonClassName(variant)}>
      {iconFor(action)}
      {children}
    </a>;
  }

  async function run() {
    if (!siteId && action !== "settings") {
      router.push("/sites/new");
      return;
    }

    setBusy(true);
    try {
      if (action === "sync") {
        notifyPartialFailures(await postAction(`/api/sites/${siteId}/sync`, "同步失败。"), "部分数据源未同步成功");
      }
      if (action === "sync-all") {
        notifyPartialFailures(await postAction(`/api/sites/${siteId}/sync/all`, "全局同步失败。"), "全局同步已完成，以下数据源本次未更新");
      }
      if (action === "geo") await postAction(`/api/sites/${siteId}/geo/run`, "GEO 测试失败。");
      if (action === "logs") await postAction(`/api/sites/${siteId}/logs/scan`, "日志扫描失败。");
      if (action === "report") await postAction(`/api/sites/${siteId}/reports/generate`, "Report generation failed.");
      if (action === "technical") await postAction(`/api/sites/${siteId}/technical-seo/run`, "Technical SEO audit failed.");
      if (action === "pagespeed") await postAction(`/api/sites/${siteId}/pagespeed/run`, "PageSpeed check failed.");
      if (action === "gsc-inspect") await postAction(`/api/sites/${siteId}/gsc/inspect`, "URL Inspection failed.");
      if (action === "indexnow") await postAction(`/api/sites/${siteId}/indexnow/submit`, "IndexNow submission failed.");
      if (action === "alert-test") {
        const result = await postAction(`/api/sites/${siteId}/alerts/test`, "Alert test failed.") as { delivery?: { ok?: boolean; error?: string } };
        alert(result.delivery?.ok ? "测试告警已发送。" : result.delivery?.error ?? "测试告警已记录。");
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  return <Button variant={variant} onClick={run} disabled={busy}>
    {busy ? <RefreshCw /> : iconFor(action)}
    {busy ? "处理中..." : children}
  </Button>;
}

async function postAction(url: string, fallbackMessage: string): Promise<ActionResult | Record<string, unknown>> {
  const response = await fetch(url, { method: "POST" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(result.results)
      ? result.results
        .filter((item: ResultItem) => !item.skipped)
        .map((item: ResultItem) => `${item.provider}: ${item.error}`)
        .join("\n")
      : undefined;
    throw new Error(result.error?.message ?? result.error ?? detail ?? fallbackMessage);
  }
  return result;
}

function notifyPartialFailures(result: ActionResult | Record<string, unknown>, title: string) {
  const failed = Array.isArray(result.results) ? result.results.filter((item) => !item.ok && !item.skipped) : [];
  if (failed.length > 0) {
    alert(`${title}：\n${failed.map((item) => `${item.provider}: ${item.error}`).join("\n")}`);
  }
}

function hrefFor(action: Action, siteId?: string, target?: IntegrationTarget) {
  if (action === "settings") return siteId ? `/sites/${siteId}/settings${target ? `?panel=${target}` : ""}` : "/sites/new";
  if (action === "alerts") return siteId ? `/sites/${siteId}/overview#alerts` : "/sites";
  if (action === "export") return siteId ? `/api/sites/${siteId}/urls/export` : "/sites";
  return null;
}

function iconFor(action: Action) {
  if (action === "sync" || action === "sync-all") return <RefreshCw />;
  if (action === "settings") return <Settings2 />;
  if (action === "export") return <Download />;
  return <Play />;
}
