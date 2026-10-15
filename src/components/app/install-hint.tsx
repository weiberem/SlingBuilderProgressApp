"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Chrome/Edge (Android, Desktop): nicht in lib.dom, deshalb hier minimal deklariert. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "unknown" | "installed" | "prompt" | "ios" | "manual";

/**
 * Modulweiter Zustand: `beforeinstallprompt` feuert oft vor dem Mounten der Einstellungsseite,
 * deshalb wird das Ereignis beim Laden des Moduls abgefangen (gleiches Muster wie offline-banner).
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || iPadOs;
}

function getMode(): Mode {
  if (installed || isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  if (isIos()) return "ios";
  return "manual";
}

const serverMode = (): Mode => "unknown";

/**
 * Unaufdringlicher Hinweis zur Installation als App (Home-Bildschirm):
 * Android/Chrome über `beforeinstallprompt` mit Knopf, iOS als Textanleitung («Teilen» → «Zum
 * Home-Bildschirm»), sonst ein allgemeiner Hinweis auf das Browsermenü. Läuft die App bereits
 * installiert, wird nur das bestätigt.
 */
export function InstallHint() {
  const t = useTranslations("pwa.install");
  const mode = useSyncExternalStore(subscribe, getMode, serverMode);
  const [dismissed, setDismissed] = useState(false);

  const install = async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") installed = true;
    else setDismissed(true);
    emit();
  };

  if (mode === "unknown") return <p className="text-sm text-ink-muted">{t("checking")}</p>;

  if (mode === "installed") {
    return (
      <p className="flex items-center gap-2 text-sm" role="status">
        <Smartphone className="size-5 shrink-0 text-status-done" aria-hidden />
        {t("installed")}
      </p>
    );
  }

  if (mode === "prompt" && !dismissed) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <Button type="button" variant="secondary" onClick={install} className="self-start">
          <Download className="size-5" aria-hidden />
          {t("button")}
        </Button>
      </div>
    );
  }

  if (mode === "ios") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            <span className="inline-flex items-center gap-2">
              <Share className="size-4 shrink-0" aria-hidden />
              {t("iosStep1")}
            </span>
          </li>
          <li>{t("iosStep2")}</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-muted">{t("intro")}</p>
      <p className="text-sm">{t("manual")}</p>
    </div>
  );
}
