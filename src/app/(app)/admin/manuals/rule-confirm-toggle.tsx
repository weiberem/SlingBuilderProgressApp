"use client";

import { Check, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { confirmRuleAction, type AdminError } from "@/modules/manuals/admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";

/** Bestätigt eine Regel oder zieht die Bestätigung zurück (ein Tipp, Status als Badge). */
export function RuleConfirmToggle({ ruleId, confirmed }: { ruleId: string; confirmed: boolean }) {
  const t = useTranslations("admin.manuals");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<AdminError | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={confirmed ? "done" : "clarify"}>{confirmed ? t("rules.confirmed") : t("rules.unconfirmed")}</Badge>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        aria-pressed={confirmed}
        onClick={() =>
          startTransition(async () => {
            const res = await confirmRuleAction({ ruleId, confirmed: !confirmed });
            setError(res.ok ? null : res.error);
          })
        }
      >
        {confirmed ? <Undo2 className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
        {confirmed ? t("rules.unconfirm") : t("rules.confirm")}
      </Button>
      {error ? <Notice tone="error">{t(`errors.${error}`)}</Notice> : null}
    </div>
  );
}
