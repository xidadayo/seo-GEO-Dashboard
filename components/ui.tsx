import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", tone === "good" && "bg-emerald-50 text-emerald-700", tone === "warn" && "bg-amber-50 text-amber-700", tone === "danger" && "bg-rose-50 text-rose-700", tone === "neutral" && "bg-slate-100 text-slate-600")}>{children}</span>;
}

export function buttonClassName(variant: "primary" | "outline" | "ghost" = "primary", className?: string) {
  return cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45", variant === "primary" && "bg-[#168779] text-white hover:bg-[#126e63]", variant === "outline" && "border border-[#dce4e7] bg-white hover:bg-slate-50", variant === "ghost" && "text-slate-600 hover:bg-slate-100", className);
}

export function Button({ children, variant = "primary", className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "outline" | "ghost" }) {
  return <button type={type} {...props} className={buttonClassName(variant, className)}>{children}</button>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[#e6ebee] bg-white", className)}>{children}</section>;
}

export function Input({ label, placeholder, type = "text", defaultValue, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex flex-col gap-2 text-sm font-medium text-slate-700"><span>{label}</span><input type={type} defaultValue={defaultValue} placeholder={placeholder} {...props} className={cn("h-11 rounded-lg border border-[#dce4e7] bg-white px-3 text-sm outline-none transition focus:border-[#168779] focus:ring-2 focus:ring-[#168779]/10", props.className)} /></label>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#dce4e7] bg-[#f8fafb] p-8 text-center">
    <p className="text-base font-semibold text-[#17212b]">{title}</p>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>;
}
