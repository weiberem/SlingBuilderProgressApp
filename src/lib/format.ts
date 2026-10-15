/** Datumsformatierung für die Anzeige (Schweiz). */
export function formatDate(value: string | Date | null | undefined, locale = "de-CH"): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale = "de-CH"): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function todayIso(): string {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tz.toISOString().slice(0, 10);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
