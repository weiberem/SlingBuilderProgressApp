import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { loadMessages, resolveLocale, type Locale } from "./messages";

/**
 * next-intl ohne lokalisierte Routen: Sprache aus dem Cookie `locale`, Standard Deutsch.
 * Englisch und Französisch sind vorbereitet (leere Strukturen in messages/en, messages/fr).
 */
export default getRequestConfig(async () => {
  const jar = await cookies();
  const locale: Locale = resolveLocale(jar.get("locale")?.value);
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Europe/Zurich",
  };
});
