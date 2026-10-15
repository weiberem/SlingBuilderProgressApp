import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, resetTestDb } from "@/test/db";
import { auditLog } from "@/modules/audit/schema";
import { users } from "@/modules/auth/schema";
import { buildProjectContext } from "@/modules/projects/context";
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
  it("bestätigt eine unbestätigte Regel mit Audit-Eintrag und wirkt danach auf die Seiten", async () => {
    const catalog = await listAdminCatalog();
    const wing = catalog.flatMap((m) => m.manuals).find((m) => m.manual.code === "wing")!;
    const unconfirmed = wing.revisions.flatMap((r) => r.rules).filter((r) => !r.confirmed);
    expect(unconfirmed.length).toBeGreaterThan(0);
    // Rib 26 (S. 32) «nur 198 L»: HB-YMR hat Long Range → nach Bestätigung fällt die Seite weg.
    const rule = unconfirmed.find((r) => r.seedKey === "wing-7:s32:198-only")!;
    expect(rule.target).toMatchObject({ kind: "section", pageFrom: 32 });

    const ctx = await buildProjectContext(adminId, projectId, { isPlatformAdmin: true });
    const pageState = async (n: number) => {
      const view = await getManualView(ctx, "wing");
      return view!.sections.flatMap((s) => s.pages).find((p) => p.page.pageNumber === n)!.status;
    };
    const before = await pageState(32);
    expect(before.relevant).toBe(true);
    expect(before.needsVariantDecision).toBe(true);

    const row = await confirmRule(adminId, rule.id, true);
    expect(row.confirmed).toBe(true);
    expect(row.confirmedBy).toBe(adminId);
    expect(row.confirmedAt).toBeInstanceOf(Date);

    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityId, rule.id));
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("confirm");
    expect(audits[0].projectId).toBeNull();
    expect(audits[0].userId).toBe(adminId);

    // Bestätigte Regel wirkt: Seite 32 trifft nicht mehr zu, nichts mehr zu klären.
    const after = await pageState(32);
    expect(after.relevant).toBe(false);
    expect(after.needsVariantDecision).toBe(false);

    const back = await confirmRule(adminId, rule.id, false);
    expect(back.confirmed).toBe(false);
    expect(back.confirmedBy).toBeNull();
    const audits2 = await getDb().select().from(auditLog).where(eq(auditLog.entityId, rule.id));
    expect(audits2.map((a) => a.action).sort()).toEqual(["confirm", "unconfirm"]);
    expect((await pageState(32)).needsVariantDecision).toBe(true);
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
