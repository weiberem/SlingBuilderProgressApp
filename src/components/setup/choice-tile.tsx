"use client";

import { Check, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";

/**
 * Grosse Auswahlkachel (mindestens 56 px hoch) für Radio- oder Checkbox-Semantik.
 * Ein Tipp genügt; keine Hover-Funktion, bedienbar mit Handschuhen und Tastatur.
 */
export function ChoiceTile({
  role,
  checked,
  onToggle,
  label,
  help,
  tone = "default",
  disabled,
  name,
}: {
  role: "radio" | "checkbox";
  checked: boolean;
  onToggle: () => void;
  label: ReactNode;
  help?: ReactNode;
  tone?: "default" | "unknown";
  disabled?: boolean;
  name?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      data-name={name}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={cx(
        "flex min-h-14 w-full items-center gap-3 rounded border px-3 py-2 text-left transition-colors",
        checked
          ? tone === "unknown"
            ? "border-status-clarify bg-status-clarify-soft"
            : "border-brand-red bg-brand-red-soft"
          : "border-line bg-bg active:bg-surface-2",
        disabled && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "flex size-7 shrink-0 items-center justify-center border-2",
          role === "radio" ? "rounded-full" : "rounded",
          checked ? (tone === "unknown" ? "border-status-clarify bg-status-clarify text-white" : "border-brand-red bg-brand-red text-on-red") : "border-line-strong bg-bg",
        )}
      >
        {checked ? <Check className="size-4" strokeWidth={3} /> : tone === "unknown" ? <HelpCircle className="size-4 text-ink-muted" /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold leading-tight">{label}</span>
        {help ? <span className="text-xs text-ink-muted">{help}</span> : null}
      </span>
    </button>
  );
}
