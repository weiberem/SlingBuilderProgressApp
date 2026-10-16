"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/format";

type Theme = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "system" ? stored : "dark";
  } catch {
    return "dark";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function writeTheme(next: Theme) {
  try {
    if (next === "dark") {
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
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  const options: Theme[] = ["dark", "light", "system"];
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
