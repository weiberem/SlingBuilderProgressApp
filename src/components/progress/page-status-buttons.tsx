"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/format";
import type { EffectiveStatus, StatusKind } from "@/modules/manuals/applicability";
import { setPageStatusAction, type ActionResult } from "@/modules/progress/progress-actions";
import { Notice } from "@/components/ui/field";
import { STATUS_ORDER, statusButtonTone } from "./status-styles";

/** Fünf grosse Status-Buttons im Seitendetail (Server Action, Seite wird neu gerendert). */
export function PageStatusButtons({ projectId, pageId, status }: { projectId: string; pageId: string; status: EffectiveStatus }) {
  const t = useTranslations("page");
  const ts = useTranslations("common.status");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const choose = (k: StatusKind) => {
    setResult(null);
    startTransition(async () => {
      const r = await setPageStatusAction({ projectId, pageId, status: k, naReason: k === "not_applicable" ? "manual" : null });
      setResult(r);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        {t("status.current", {
          status: status.status === "not_applicable" ? `${ts("not_applicable")} (${ts(`naReason.${status.naReason ?? "manual"}`)})` : ts(status.status),
        })}{" "}
        · {status.derived ? t("status.derived") : t("status.setBy")}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label={t("status.title")}>
        {STATUS_ORDER.map((k) => {
          const active = !status.derived && status.status === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => choose(k)}
              className={cx("min-h-14 rounded border-2 px-3 text-base font-semibold transition-colors disabled:opacity-60", active ? statusButtonTone[k].active : statusButtonTone[k].idle)}
            >
              {ts(k)}
            </button>
          );
        })}
      </div>
      {result?.ok ? <Notice tone="success">{t("status.saved")}</Notice> : null}
      {result && !result.ok ? <Notice tone="error">{t(`errors.${result.error}`)}</Notice> : null}
    </div>
  );
}
