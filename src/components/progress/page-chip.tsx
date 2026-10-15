"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, MoreHorizontal } from "lucide-react";
import { cx } from "@/lib/format";
import type { PageDto } from "@/modules/progress/view-dto";
import { chipTone, hatchedStyle } from "./status-styles";

const LONG_PRESS_MS = 500;

/**
 * Seiten-Chip (56 px hoch, Mono-Ziffern). Tippen = Status-Zyklus, langes Drücken (≈500 ms) oder «…» = Bottom-Sheet.
 * Keine Hover- oder Doppeltipp-Funktionen (Handschuhe). Chips sind Buttons (Tastatur).
 */
export function PageChip({ page, pending, onTap, onOpen }: { page: PageDto; pending?: boolean; onTap: (page: PageDto) => void; onOpen: (page: PageDto) => void }) {
  const t = useTranslations("manual.chip");
  const ts = useTranslations("common.status");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clear, [clear]);

  const s = page.status;
  const derived = s.derived && s.status === "not_applicable";
  const statusText =
    s.status === "not_applicable" ? `${ts("not_applicable")} ${t("naReason", { reason: ts(`naReason.${s.naReason ?? "manual"}`) })}` : ts(s.status);
  const extras = [s.needsVariantDecision ? t("clarify") : null, s.conflictsWithConfig ? t("conflict") : null, pending ? t("saving") : null].filter(Boolean);
  const label = `${t("label", { n: page.pageNumber, status: statusText })}${extras.length ? ` – ${extras.join(", ")}` : ""}`;

  return (
    <div className="relative">
      <button
        type="button"
        className={cx(
          "flex h-14 min-w-14 touch-manipulation select-none items-center justify-center gap-1 rounded border-2 px-2 font-mono text-lg font-semibold tabular-nums transition-colors",
          chipTone[s.status],
          derived && "opacity-60",
          s.needsVariantDecision && "border-dashed border-status-clarify",
          s.conflictsWithConfig && "ring-2 ring-brand-red ring-offset-1 ring-offset-bg",
          pending && "animate-pulse",
        )}
        style={{ WebkitTouchCallout: "none", ...(derived ? hatchedStyle : {}) }}
        aria-label={label}
        title={page.titleDisplay}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          longPressed.current = false;
          clear();
          timer.current = setTimeout(() => {
            timer.current = null;
            longPressed.current = true;
            onOpen(page);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={(e) => {
          e.preventDefault();
          clear();
          if (!longPressed.current) {
            longPressed.current = true;
            onOpen(page);
          }
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onTap(page);
        }}
      >
        {s.status === "done" ? <Check className="size-4" aria-hidden /> : null}
        <span>{page.pageNumber}</span>
        {s.needsVariantDecision ? <span aria-hidden className="absolute -top-1 -left-1 size-3 rounded-full border border-bg bg-status-clarify" /> : null}
      </button>
      <button
        type="button"
        className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-muted"
        aria-label={t("more", { n: page.pageNumber })}
        onClick={() => onOpen(page)}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
    </div>
  );
}
