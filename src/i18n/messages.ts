import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const LOCALES = ["de", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export function resolveLocale(value: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

type Messages = Record<string, unknown>;

const cache = new Map<Locale, Messages>();

/**
 * Lädt alle JSON-Dateien unter messages/<locale>/ und fügt sie zu einem Objekt zusammen.
 * Jede Datei ist ein Namensraum (z. B. messages/de/progress.json → Schlüssel "progress").
 * Fehlende Schlüssel fallen auf Deutsch zurück.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  if (process.env.NODE_ENV === "production" && cache.has(locale)) return cache.get(locale)!;
  const base = locale === DEFAULT_LOCALE ? {} : await loadDir(DEFAULT_LOCALE);
  const own = await loadDir(locale);
  const merged = deepMerge(base, own);
  cache.set(locale, merged);
  return merged;
}

async function loadDir(locale: Locale): Promise<Messages> {
  const dir = path.join(process.cwd(), "messages", locale);
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return {};
  }
  const out: Messages = {};
  for (const f of files) {
    const ns = f.replace(/\.json$/, "");
    out[ns] = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  }
  return out;
}

function deepMerge(a: Messages, b: Messages): Messages {
  const out: Messages = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    if (prev && typeof prev === "object" && !Array.isArray(prev) && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(prev as Messages, v as Messages);
    } else {
      out[k] = v;
    }
  }
  return out;
}
