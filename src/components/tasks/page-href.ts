/**
 * Link auf die Detailansicht einer Handbuchseite. Einzige Stelle, an der Zusatzarbeiten und Fehlteile
 * die Seitenroute bilden; ändert sich die Route der Handbuch-Ansicht, wird nur hier angepasst.
 */
export function pageHref(projectId: string, _manualCode: string, pageId: string): string {
  return `/p/${projectId}/pages/${pageId}`;
}

/** Anzeigeform einer Menge aus der Datenbank (numeric als String, z. B. "20.00" → "20"). */
export function formatQuantity(value: string | number, locale = "de-CH"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
}
