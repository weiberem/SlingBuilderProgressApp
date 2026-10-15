import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, resetTestDb } from "@/test/db";
import { buildProjectContext, type ProjectContext } from "@/modules/projects/context";
import { auditLog } from "@/modules/audit/schema";
import { deleteDeviation, getWizardData, markOnboardingComplete, saveBuildType, saveProjectOption, upsertDeviation } from "./service";
import { checkAnswerForDimension } from "./setup-input";

/** Onboarding gegen die Datenbank: unbekannte Werte werden abgelehnt, gültige Antworten mit Audit gespeichert. */
let ctx: ProjectContext;

beforeAll(async () => {
  const { userId, projectId } = await resetTestDb();
  ctx = await buildProjectContext(userId, projectId, { userName: "Test" });
});

afterAll(async () => {
  await closeDb();
});

describe("Onboarding-Antworten speichern", () => {
  it("liefert Gruppen aus den Stammdaten inkl. build und deviations", async () => {
    const data = await getWizardData(ctx);
    const codes = data.groups.map((g) => g.code);
    expect(codes[0]).toBe("build");
    expect(codes).toContain("deviations");
    expect(data.buildTypes.length).toBeGreaterThan(0);
    const brakes = data.groups.flatMap((g) => g.dimensions).find((d) => d.code === "brakes");
    expect(brakes?.values.map((v) => v.code)).toEqual(["matco", "beringer"]);
  });

  it("lehnt unbekannte Werte-Codes ab (Vorprüfung und Service)", async () => {
    const data = await getWizardData(ctx);
    const brakes = data.groups.flatMap((g) => g.dimensions).find((d) => d.code === "brakes")!;
    expect(checkAnswerForDimension(brakes, brakes.values, { codes: ["grove"] })).toEqual({ ok: false, error: "unknown_value" });
    await expect(saveProjectOption(ctx, "brakes", { codes: ["grove"] })).rejects.toThrow(/unbekannt/);
    await expect(saveProjectOption(ctx, "brakes", { codes: ["matco", "beringer"] })).rejects.toThrow(/Nur ein Wert/);
    await expect(saveProjectOption(ctx, "no_such_dimension", { codes: ["matco"] })).rejects.toThrow(/unbekannt/);
    // Unverändert gespeichert: Beringer aus dem Seed.
    const after = await getWizardData(ctx);
    expect(after.groups.flatMap((g) => g.dimensions).find((d) => d.code === "brakes")!.answer).toEqual({ codes: ["beringer"] });
  });

  it("speichert gültige Antworten und «weiss ich nicht» mit Audit-Eintrag", async () => {
    await saveProjectOption(ctx, "brakes", { codes: ["matco"], note: "Testnotiz" });
    await saveProjectOption(ctx, "lights", { unknown: true });
    const data = await getWizardData(ctx);
    const byCode = Object.fromEntries(data.groups.flatMap((g) => g.dimensions).map((d) => [d.code, d.answer]));
    expect(byCode.brakes).toEqual({ codes: ["matco"], note: "Testnotiz" });
    expect(byCode.lights).toEqual({ unknown: true });
    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityType, "project_option"));
    const brakesAudit = audits.find((a) => (a.newValue as { codes?: string[] })?.codes?.[0] === "matco");
    expect(brakesAudit?.oldValue).toEqual({ codes: ["beringer"] });
  });

  it("speichert die Build-Art je Baugruppe", async () => {
    await saveBuildType(ctx, "fuselage", "quick_build");
    const data = await getWizardData(ctx);
    expect(data.buildTypes.find((b) => b.group.code === "fuselage")?.buildType).toBe("quick_build");
    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityType, "project_build_type"));
    expect(audits.some((a) => a.entityId === "fuselage" && a.newValue === "quick_build")).toBe(true);
  });

  it("Abweichungen anlegen, ändern, löschen", async () => {
    const before = (await getWizardData(ctx)).deviations.length;
    const id = await upsertDeviation(ctx, { title: "Testabweichung", category: "Test" });
    await upsertDeviation(ctx, { id, title: "Testabweichung geändert", status: "done" });
    let data = await getWizardData(ctx);
    const dev = data.deviations.find((d) => d.id === id);
    expect(dev?.title).toBe("Testabweichung geändert");
    expect(dev?.status).toBe("done");
    expect(dev?.category).toBeNull();
    await deleteDeviation(ctx, id);
    data = await getWizardData(ctx);
    expect(data.deviations.length).toBe(before);
  });

  it("Konfiguration abschliessen setzt onboardingCompletedAt", async () => {
    expect((await getWizardData(ctx)).project.settings.onboardingCompletedAt).toBeUndefined();
    await markOnboardingComplete(ctx);
    expect((await getWizardData(ctx)).project.settings.onboardingCompletedAt).toBeTruthy();
  });
});
