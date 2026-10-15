# Sling Builder Tracker – Hinweise für die Arbeit im Repo

Web-App für Erbauer von Sling-Kitflugzeugen (Baufortschritt nach Sling Construction Manuals, EAS/BAZL-Dossier).
Auftraggeber: Remy Weibel (HB-YMR, Sling 4 TSi). Sprache der UI und der Dokumente: Deutsch (Schweiz, «ss» statt «ß»).

## Grundsätze (nicht verhandelbar, aus dem Auftrag)

1. **Nie mutmassen.** Unklares wird als «ungeklärt / Variante klären» markiert, nie stillschweigend angenommen.
2. **Keine HB-YMR-Spezifika im Code.** Alles Projekt- und Modellspezifische liegt in `seed/` oder in der Datenbank.
3. **Fortschritt gehört dem Erbauer.** Jeder Zugriff auf Projektdaten läuft über einen `ProjectContext` (`src/modules/projects/context.ts`).
4. **Keine PDFs zentral speichern.** Nur Struktur und Hashes; PDFs liegen im Drive des Builders.
5. **Keine Texte im Code.** UI-Texte über next-intl (`messages/de/<namespace>.json`), Stammdaten-Labels als `{de,en,fr}`.
6. **Jede Statusänderung ins Audit-Log** (`src/modules/audit/service.ts`).

## Befehle

```
pnpm install            # Abhängigkeiten
pnpm db:migrate         # Migrationen anwenden (drizzle/)
pnpm db:generate        # Migration aus Schema-Änderungen erzeugen (nie bestehende Migrationen editieren)
pnpm seed               # Stammdaten + erster Nutzer (SEED_ADMIN_*) + Projekt HB-YMR, idempotent
pnpm import:prototype seed/hb-ymr/prototype-export-2026-10-15.json
pnpm dev | pnpm build | pnpm start
pnpm typecheck | pnpm lint | pnpm test | pnpm test:e2e
```

Lokale PostgreSQL-Datenbanken: `sling_dev` (App) und `sling_test` (Vitest, wird pro Lauf geleert; `TEST_DATABASE_URL`).

## Struktur

- `docs/architecture.md` Architektur und Datenmodell (Freigabe-Entwurf), `docs/rueckfragen.md` offene Fragen, `docs/recherche.md` Rechercheergebnisse.
- `src/modules/<modul>/` mit `schema.ts` (Drizzle), `service.ts`, `*-actions.ts` (Server Actions, zod-validiert), Tests daneben.
- `src/modules/manuals/applicability.ts` dreiwertige Varianten-Logik, `aliases.ts` Begriffs-Normalisierung.
- `seed/sling-4-tsi/` Handbuch-Stammdaten, Optionen, Regeln, Aliase; `seed/hb-ymr/` Projektantworten und Prototyp-Export.
- `src/styles/tokens.css` Design-Tokens (Sling Aircraft Switzerland: Schwarz, Weiss, Rot). `src/components/ui/*` Primitive.
- Next.js 16: `src/proxy.ts` (statt middleware), `cookies()/headers()/params` sind async, Docs unter `node_modules/next/dist/docs/`.

## Konventionen

- Mobile zuerst, Touch-Ziele mindestens 48 px (Seiten-Chips 56 px), keine Hover-only-Funktionen.
- Server Actions geben `{ ok: true } | { ok: false, error: <code> }` zurück; Fehlercodes werden in der UI übersetzt.
- Seed-Daten idempotent (stabile Schlüssel: Codes, Revisionen, Seitennummern, `seedKey`). Seiten werden nie gelöscht.
- Commits auf Deutsch, Meilensteine lauffähig und getestet; kein «fertig» ohne grüne Tests.
