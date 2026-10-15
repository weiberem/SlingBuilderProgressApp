import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/format";

const control =
  "w-full min-h-12 rounded border border-line bg-bg px-3 text-base text-ink placeholder:text-ink-muted/70 focus:border-line-strong";

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      {error ? <span className="text-sm text-status-problem">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "min-h-24 py-2", className)} {...props} />;
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return <input type="checkbox" className={cx("size-6 shrink-0 accent-[var(--brand-red)]", className)} {...props} />;
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-status-progress bg-status-progress-soft",
    warn: "border-status-clarify bg-status-clarify-soft",
    error: "border-status-problem bg-status-problem-soft",
    success: "border-status-done bg-status-done-soft",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded border-l-4 px-3 py-2 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
