"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Play, RefreshCw, Settings2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui";

type Action = "sync" | "settings" | "export" | "health" | "alerts" | "geo" | "logs" | "report" | "technical" | "indexnow" | "alert-test" | "pagespeed" | "gsc-inspect";
type IntegrationTarget = "google-search-console" | "ga4" | "pagespeed" | "bing-indexnow" | "ai-search" | "logs" | "alerts" | "sharing";

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
        const response = await fetch(`/api/sites/${siteId}/sync`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error ?? result.results?.map((item: { provider: string; error?: string }) => `${item.provider}: ${item.error}`).join("\n") ?? "同步失败。");
        }
        const failed = result.results?.filter((item: { ok: boolean }) => !item.ok) ?? [];
        if (failed.length > 0) {
          alert(`部分数据源未同步成功：\n${failed.map((item: { provider: string; error?: string }) => `${item.provider}: ${item.error}`).join("\n")}`);
        }
      }
      if (action === "geo") {
        const response = await fetch(`/api/sites/${siteId}/geo/run`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "GEO 测试失败。");
      }
      if (action === "logs") {
        const response = await fetch(`/api/sites/${siteId}/logs/scan`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "日志扫描失败。");
      }
      if (action === "report") {
        const response = await fetch(`/api/sites/${siteId}/reports/generate`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Report generation failed.");
      }
      if (action === "technical") {
        const response = await fetch(`/api/sites/${siteId}/technical-seo/run`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Technical SEO audit failed.");
      }
      if (action === "pagespeed") {
        const response = await fetch(`/api/sites/${siteId}/pagespeed/run`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "PageSpeed check failed.");
      }
      if (action === "gsc-inspect") {
        const response = await fetch(`/api/sites/${siteId}/gsc/inspect`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "URL Inspection failed.");
      }
      if (action === "indexnow") {
        const response = await fetch(`/api/sites/${siteId}/indexnow/submit`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message ?? result.error ?? "IndexNow submission failed.");
      }
      if (action === "alert-test") {
        const response = await fetch(`/api/sites/${siteId}/alerts/test`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message ?? result.error ?? result.delivery?.error ?? "Alert test failed.");
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

function hrefFor(action: Action, siteId?: string, target?: IntegrationTarget) {
  if (action === "settings") return siteId ? `/sites/${siteId}/settings${target ? `?panel=${target}` : ""}` : "/sites/new";
  if (action === "alerts") return siteId ? `/sites/${siteId}/overview#alerts` : "/sites";
  if (action === "export") return siteId ? `/api/sites/${siteId}/urls/export` : "/sites";
  return null;
}

function iconFor(action: Action) {
  if (action === "sync") return <RefreshCw />;
  if (action === "settings") return <Settings2 />;
  if (action === "export") return <Download />;
  return <Play />;
}
