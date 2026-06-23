"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Panel } from "@/components/ui";

const steps = ["基础站点信息", "发现设置", "品牌与 GEO 词", "连接 API", "首次扫描"];

function normalizeUrlInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "创建站点失败。";
  if ("message" in error && typeof error.message === "string") return error.message;
  if ("fieldErrors" in error && error.fieldErrors && typeof error.fieldErrors === "object") {
    const entries = Object.entries(error.fieldErrors as Record<string, string[]>).filter(([, messages]) => messages?.length);
    if (entries.length > 0) return entries.map(([field, messages]) => `${field}: ${messages.join(", ")}`).join(" · ");
  }
  return "请检查站点字段。";
}

export default function NewSitePage() {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }

    setIsSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      domain: String(form.get("domain") ?? "").trim(),
      primaryUrl: normalizeUrlInput(form.get("primaryUrl")),
      sitemapUrl: normalizeUrlInput(form.get("sitemapUrl")),
      robotsUrl: normalizeUrlInput(form.get("robotsUrl")),
      wordpressApiUrl: normalizeUrlInput(form.get("wordpressApiUrl")),
      timezone: String(form.get("timezone") ?? "UTC").trim() || "UTC",
    };

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(errorMessage(result.error));
      if (payload.sitemapUrl) {
        await fetch(`/api/sites/${result.site.id}/sitemap/fetch`, { method: "POST" });
      }
      router.push(`/sites/${result.site.id}/overview`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "创建站点失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return <AppShell><div className="mx-auto max-w-4xl"><h1 className="text-3xl font-semibold">添加新站点</h1><p className="mt-2 text-sm text-slate-500">创建可复用的站点档案，并运行首次发现扫描。</p><div className="mt-7 flex gap-2 overflow-x-auto">{steps.map((s, i) => <button key={s} onClick={() => setStep(i)} className={`min-w-fit border-b-2 px-3 py-3 text-xs font-semibold ${i === step ? "border-[#168779] text-[#168779]" : "border-transparent text-slate-400"}`}>{i + 1}. {s}</button>)}</div><Panel className="mt-5 p-7"><form onSubmit={submit}><h2 className="text-xl font-semibold">{steps[step]}</h2><p className="mt-2 text-sm text-slate-500">{step === 0 ? "先填写此网站的标准身份信息。" : "你可以先保存，稍后再到设置中连接更多服务商。"}</p><div className="mt-7 grid gap-5 md:grid-cols-2"><Input label="站点名称" name="name" placeholder="你的网站名称" required /><Input label="域名" name="domain" placeholder="example.com" required /><Input label="主 URL" name="primaryUrl" placeholder="https://example.com" required /><Input label="站点地图 URL" name="sitemapUrl" placeholder="https://example.com/sitemap.xml" /><Input label="Robots.txt URL" name="robotsUrl" placeholder="https://example.com/robots.txt" /><Input label="WordPress REST API" name="wordpressApiUrl" placeholder="https://example.com/wp-json" /><Input label="时区" name="timezone" placeholder="UTC" defaultValue="UTC" /></div>{error ? <p className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}<div className="mt-8 flex justify-between"><Button variant="outline" disabled={step === 0 || isSaving} onClick={() => setStep((value) => Math.max(0, value - 1))}>上一步</Button><Button type="submit" disabled={isSaving}>{step === 4 ? isSaving ? "创建中..." : "创建站点" : "继续"}</Button></div></form></Panel></div></AppShell>;
}
