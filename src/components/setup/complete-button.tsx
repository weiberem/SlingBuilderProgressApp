"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { completeOnboardingAction, type SetupError } from "@/modules/projects/setup-actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";

/** «Konfiguration abschliessen»: setzt onboardingCompletedAt; Antworten bleiben jederzeit änderbar. */
export function CompleteButton({ projectId, alreadyCompleted }: { projectId: string; alreadyCompleted: boolean }) {
  const t = useTranslations("setup");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"ok" | SetupError | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {result === "ok" ? <Notice tone="success">{t("summary.completed")}</Notice> : result ? <Notice tone="error">{t(`errors.${result}`)}</Notice> : null}
      <Button
        size="lg"
        variant={alreadyCompleted ? "secondary" : "primary"}
        disabled={pending}
        className="self-start"
        onClick={() =>
          startTransition(async () => {
            const res = await completeOnboardingAction({ projectId });
            setResult(res.ok ? "ok" : res.error);
          })
        }
      >
        <CheckCircle2 className="size-5" aria-hidden />
        {alreadyCompleted ? t("summary.completeAgain") : t("summary.complete")}
      </Button>
      <p className="text-xs text-ink-muted">{t("summary.completeHint")}</p>
    </div>
  );
}
