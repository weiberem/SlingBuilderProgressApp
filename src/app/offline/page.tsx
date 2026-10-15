import { getTranslations } from "next-intl/server";

export const metadata = { title: "Offline" };

/** Fallback-Seite des Service Workers, wenn eine nicht gecachte Seite offline geöffnet wird. */
export default async function OfflinePage() {
  const t = await getTranslations("common.offline");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl">{t("pageTitle")}</h1>
      <p className="text-ink-muted">{t("pageText")}</p>
    </main>
  );
}
