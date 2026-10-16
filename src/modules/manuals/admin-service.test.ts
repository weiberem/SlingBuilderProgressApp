import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, resetTestDb } from "@/test/db";
import { auditLog } from "@/modules/audit/schema";
import { users } from "@/modules/auth/schema";
import { buildProjectContext } from "@/modules/projects/context-core";
import { getManualView } from "@/modules/progress/service";
import { confirmRule, listAdminCatalog, setRevisionPageCountAsAdmin } from "./admin-service";
import { applicabilityRules } from "./schema";

let adminId: string;
let projectId: string;

beforeAll(async () => {
  const r = await resetTestDb();
  adminId = r.userId;
  projectId = r.projectId;
});

afterAll(async () => {
  await closeDb();
});

describe("Admin: Regeln bestätigen", () => {
  it("hebt eine Bestätigung auf (Seite wird «klären») und bestätigt wieder, je mit Audit-Eintrag", async () => {
    const catalog = await listAdminCatalog();
    const wing = catalog.flatMap((m) => m.manuals).find((m) => m.manual.code === "wing")!;
    const rules = wing.revisions.flatMap((r) => r.rules);
    expect(rules.some((r) => !r.confirmed), "mindestens eine unbestätigte Regel im Wing (Wig-Wag)").toBe(true);
    // Rib 26 (S. 32) «nur 198 L» ist seit 16.10.2026 bestätigt: HB-YMR hat Long Range → Seite fällt weg.
    const rule = rules.find((r) => r.seedKey === "wing-7:s32:198-only")!;
    expect(rule.confirmed).toBe(true);
    expect(rule.target).toMatchObject({ kind: "section", pageFrom: 32 });

    const ctx = await buildProjectContext(adminId, projectId, { isPlatformAdmin: true });
    const pageState = async (n: number) => {
      const view = await getManualView(ctx, "wing");
      return view!.sections.flatMap((s) => s.pages).find((p) => p.page.pageNumber === n)!.status;
    };
    const before = await pageState(32);
    expect(before.relevant).toBe(false);
    expect(before.needsVariantDecision).toBe(false);

    // Bestätigung aufheben: unbestätigte Regel wirkt nicht, markiert nur «klären».
    const back = await confirmRule(adminId, rule.id, false);
    expect(back.confirmed).toBe(false);
    expect(back.confirmedBy).toBeNull();
    const mid = await pageState(32);
    expect(mid.relevant).toBe(true);
    expect(mid.needsVariantDecision).toBe(true);

    const row = await confirmRule(adminId, rule.id, true);
    expect(row.confirmed).toBe(true);
    expect(row.confirmedBy).toBe(adminId);
    expect(row.confirmedAt).toBeInstanceOf(Date);
    const after = await pageState(32);
    expect(after.relevant).toBe(false);
    expect(after.needsVariantDecision).toBe(false);

    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityId, rule.id));
    expect(audits.map((a) => a.action).sort()).toEqual(["confirm", "unconfirm"]);
    expect(audits.every((a) => a.projectId === null && a.userId === adminId)).toBe(true);
  });

  it("lehnt Nicht-Admins und unbekannte Regeln ab", async () => {
    const [rule] = await getDb().select().from(applicabilityRules).limit(1);
    const [other] = await getDb()
      .insert(users)
      .values({ email: "builder@example.org", name: "Builder", passwordHash: "x", isPlatformAdmin: false })
      .returning();
    await expect(confirmRule(other.id, rule.id, true)).rejects.toThrow(/Berechtigung/);
    await expect(confirmRule(adminId, "01900000-0000-7000-8000-000000000000", true)).rejects.toThrow(/nicht gefunden/);
  });
});

describe("Admin: Seitenzahl erfassen", () => {
  it("legt für eine Revision ohne Struktur Seiten ohne Titel an (mit Audit)", async () => {
    const catalog = await listAdminCatalog();
    const fuselage = catalog.flatMap((m) => m.manuals).find((m) => m.manual.code === "fuselage")!;
    const rev = fuselage.revisions.find((r) => r.canSetPageCount)!;
    expect(rev).toBeTruthy();
    await setRevisionPageCountAsAdmin({ id: adminId, isPlatformAdmin: true }, rev.revision.id, 12);
    const again = await listAdminCatalog();
    const r2 = again.flatMap((m) => m.manuals).find((m) => m.manual.code === "fuselage")!.revisions.find((r) => r.revision.id === rev.revision.id)!;
    expect(r2.revision.pageCount).toBe(12);
    expect(r2.pageRowCount).toBe(12);
    expect(r2.canSetPageCount).toBe(true);
    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityId, rev.revision.id));
    expect(audits.some((a) => a.action === "set_page_count" && a.newValue === 12)).toBe(true);
  });

  it("lehnt Nicht-Admins ab", async () => {
    const catalog = await listAdminCatalog();
    const rev = catalog.flatMap((m) => m.manuals).flatMap((m) => m.revisions)[0];
    await expect(setRevisionPageCountAsAdmin({ id: adminId, isPlatformAdmin: false }, rev.revision.id, 5)).rejects.toThrow(/Berechtigung/);
  });
});
