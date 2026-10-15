"use client";

import { useCallback, useRef, useState } from "react";
import { previewSetupChangeAction, type DiffByManual, type SetupError, type SetupResult } from "@/modules/projects/setup-actions";
import type { SetupChange } from "./types";

export type SaveState =
  | { phase: "idle" }
  | { phase: "previewing" }
  | { phase: "confirm"; changes: DiffByManual[]; total: number }
  | { phase: "saving" }
  | { phase: "saved" }
  | { phase: "error"; error: SetupError };

/**
 * Ablauf «Vorschau → Übernehmen → Speichern»: Vor dem Speichern zeigt die App, welche Seiten
 * dazukommen, wegfallen oder zu klären sind. Ohne Auswirkung wird direkt gespeichert.
 */
export function useSetupSave(projectId: string) {
  const [state, setState] = useState<SaveState>({ phase: "idle" });
  const pending = useRef<{ save: () => Promise<SetupResult>; onCancel?: () => void } | null>(null);

  const doSave = useCallback(async (save: () => Promise<SetupResult>) => {
    setState({ phase: "saving" });
    const res = await save();
    setState(res.ok ? { phase: "saved" } : { phase: "error", error: res.error });
    return res.ok;
  }, []);

  const submit = useCallback(
    async (change: SetupChange, save: () => Promise<SetupResult>, onCancel?: () => void) => {
      setState({ phase: "previewing" });
      const preview = await previewSetupChangeAction({ projectId, change });
      if (!preview.ok) {
        setState({ phase: "error", error: preview.error });
        onCancel?.();
        return false;
      }
      if (preview.total === 0) return doSave(save);
      pending.current = { save, onCancel };
      setState({ phase: "confirm", changes: preview.changes, total: preview.total });
      return null;
    },
    [projectId, doSave],
  );

  const confirm = useCallback(async () => {
    const p = pending.current;
    pending.current = null;
    if (!p) return false;
    return doSave(p.save);
  }, [doSave]);

  const cancel = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    p?.onCancel?.();
    setState({ phase: "idle" });
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  const busy = state.phase === "previewing" || state.phase === "saving";
  return { state, submit, confirm, cancel, reset, busy };
}
