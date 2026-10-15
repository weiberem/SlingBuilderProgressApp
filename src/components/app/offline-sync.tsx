"use client";

import { useEffect } from "react";
import { startSyncRunner } from "@/lib/offline";

/** Startet den Offline-Sync-Läufer einmal pro Sitzung, damit wartende Änderungen von jeder Seite aus gesendet werden. */
export function OfflineSync() {
  useEffect(() => {
    try {
      startSyncRunner();
    } catch {
      /* ohne IndexedDB (z. B. privates Fenster) läuft die App ohne Warteschlange */
    }
  }, []);
  return null;
}
