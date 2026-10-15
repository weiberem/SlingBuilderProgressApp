"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/**
 * Zeigt den Offline-Zustand und wartende Änderungen. Die Warteschlange selbst lebt in
 * `src/lib/offline` (Dexie); sie meldet die Anzahl über das Ereignis `sbt:pending`.
 */
let pendingCount = 0;
const pendingListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("sbt:pending", (e) => {
    pendingCount = (e as CustomEvent<number>).detail ?? 0;
    pendingListeners.forEach((l) => l());
  });
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function subscribePending(cb: () => void) {
  pendingListeners.add(cb);
  return () => pendingListeners.delete(cb);
}

export function OfflineBanner() {
  const t = useTranslations("common.offline");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const pending = useSyncExternalStore(subscribePending, () => pendingCount, () => 0);

  if (online && pending === 0) return null;
  return (
    <div role="status" className="border-b border-status-clarify bg-status-clarify-soft px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1">
        {!online ? <span className="font-semibold">{t("banner")}</span> : null}
        {pending > 0 ? <span>{t("pending", { count: pending })}</span> : null}
      </div>
    </div>
  );
}
