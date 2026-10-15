"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ClipboardList, Hammer, LogOut, Package, Settings, SlidersHorizontal, Database } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions";
import { cx } from "@/lib/format";
import { Brand } from "./brand";
import { OfflineBanner } from "./offline-banner";

export type NavItem = { key: "build" | "tasks" | "parts" | "setup" | "settings" | "admin" | "projects"; href: string };

const icons = {
  build: Hammer,
  tasks: ClipboardList,
  parts: Package,
  setup: SlidersHorizontal,
  settings: Settings,
  admin: Database,
  projects: Database,
};

/**
 * App-Rahmen: schwarze Kopfleiste mit Marke, Projekt-Kennzeichen und Navigation (Desktop),
 * Tab-Leiste unten (Mobile). Alle Ziele mindestens 48 px.
 */
export function AppShell({
  nav,
  registration,
  userName,
  isAdmin,
  children,
}: {
  nav: NavItem[];
  registration?: string | null;
  userName: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("common.nav");
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const mobile = nav.filter((n) => ["build", "tasks", "parts", "setup", "projects"].includes(n.key)).slice(0, 4);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-bg focus:px-3 focus:py-2">
        {t("skipToContent")}
      </a>
      <header className="sticky top-0 z-30 border-b-2 border-brand-red bg-brand-black text-brand-white" style={{ paddingTop: "env(safe-area-inset-top, 0)" }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Brand compact={!!registration} />
          {registration ? (
            <span className="rounded bg-brand-red px-2 py-1 font-display text-sm font-bold tracking-[0.12em] text-on-red">{registration}</span>
          ) : null}
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Hauptnavigation">
            {nav.map((n) => {
              const Icon = icons[n.key];
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className={cx(
                    "touch flex items-center gap-2 rounded px-3 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white",
                    isActive(n.href) && "bg-white/15 text-white",
                  )}
                  aria-current={isActive(n.href) ? "page" : undefined}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(n.key)}
                </Link>
              );
            })}
            {isAdmin && !nav.some((n) => n.key === "admin") ? (
              <Link href="/admin/manuals" className={cx("touch flex items-center gap-2 rounded px-3 text-sm font-semibold text-white/85 hover:bg-white/10", isActive("/admin") && "bg-white/15 text-white")}>
                <Database className="size-4" aria-hidden />
                {t("admin")}
              </Link>
            ) : null}
            <Link href="/settings" className={cx("touch flex items-center gap-2 rounded px-3 text-sm font-semibold text-white/85 hover:bg-white/10", isActive("/settings") && "bg-white/15 text-white")} title={userName}>
              <Settings className="size-4" aria-hidden />
              {t("settings")}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="touch flex items-center gap-2 rounded px-3 text-sm font-semibold text-white/85 hover:bg-white/10" title={t("logout")}>
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only">{t("logout")}</span>
              </button>
            </form>
          </nav>
          <Link href="/settings" className="touch ml-auto flex items-center justify-center rounded text-white/85 md:hidden" aria-label={t("settings")}>
            <Settings className="size-6" aria-hidden />
          </Link>
        </div>
      </header>
      <OfflineBanner />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:pb-10">
        {children}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        aria-label="Navigation"
      >
        <ul className="grid auto-cols-fr grid-flow-col">
          {mobile.map((n) => {
            const Icon = icons[n.key];
            const active = isActive(n.href);
            return (
              <li key={n.key}>
                <Link
                  href={n.href}
                  className={cx("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", active ? "text-brand-red" : "text-ink-muted")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-6" aria-hidden />
                  {t(n.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
