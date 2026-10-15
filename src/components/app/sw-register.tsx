"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker (public/sw.js, gebaut aus src/sw/sw.ts) nur im Produktionsbuild.
 * In der Entwicklung bleibt er aus, damit Hot Reload und Caches sich nicht in die Quere kommen;
 * ein dort noch aktiver Worker wird abgemeldet.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        /* kein SW (z. B. privates Fenster): App läuft ohne Offline-Cache */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
