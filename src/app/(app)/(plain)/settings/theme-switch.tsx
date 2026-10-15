"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/format";

type Theme = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function writeTheme(next: Theme) {
  try {
    if (next === "system") {
      localStorage.removeItem("theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.dataset.theme = next;
    }
  } catch {}
  listeners.forEach((l) => l());
}

export function ThemeSwitch() {
  const t = useTranslations("auth.settings");
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const options: Theme[] = ["system", "light", "dark"];
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={theme === o}
          onClick={() => writeTheme(o)}
          className={cx("touch rounded border px-4 text-sm font-semibold", theme === o ? "border-brand-red bg-brand-red-soft" : "border-line bg-bg")}
        >
          {t(o === "system" ? "themeSystem" : o === "light" ? "themeLight" : "themeDark")}
        </button>
      ))}
    </div>
  );
}
