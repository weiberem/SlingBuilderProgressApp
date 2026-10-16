import { expect, test } from "@playwright/test";
import { messages, projectId as storedProjectId } from "./helpers";

/**
 * Kernabläufe M1: Seite abhaken (persistiert nach Neuladen), Abschnitt erledigen und zurücksetzen,
 * Zusatzarbeit anlegen und erledigen, Konfigurationsänderung zeigt die Auswirkung vor dem Speichern.
 * Die Tests räumen ihre Änderungen wieder auf.
 */
const common = messages("common");
const manual = messages("manual");
const tasks = messages("tasks");
const setup = messages("setup");

const chipName = (n: number, status: string) => `Seite ${n}: ${common.status[status]}`;

const login = async () => storedProjectId();

test("Seite abhaken: offen → erledigt → trifft nicht zu → offen, persistiert", async ({ page }) => {
  const projectId = await login();
  await page.goto(`/p/${projectId}/manuals/empennage`);
  // Seite 24 ist im Prototyp-Stand offen (Rudder Assembly).
  const open = page.getByRole("button", { name: new RegExp(`^${chipName(24, "open")}`) });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(24, "done")}`) })).toBeVisible();
  await page.waitForTimeout(800); // Sync-Läufer sendet die Änderung
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(24, "done")}`) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${chipName(24, "done")}`) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(24, "not_applicable")}`) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${chipName(24, "not_applicable")}`) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(24, "open")}`) })).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(24, "open")}`) })).toBeVisible();
});

test("Abschnitt erledigen und zurücksetzen", async ({ page }) => {
  const projectId = await login();
  await page.goto(`/p/${projectId}/manuals/undercarriage`);
  const section = page.locator("section").filter({ has: page.getByRole("button", { name: /^Seite 19:/ }) }).first();
  await expect(section).toBeVisible();
  await section.getByRole("button", { name: manual.section.markDone }).click();
  await expect(section.getByRole("button", { name: new RegExp(`^${chipName(19, "done")}`) })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await section.getByRole("button", { name: manual.section.reset }).click();
  await expect(section.getByRole("button", { name: new RegExp(`^${chipName(19, "open")}`) })).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(19, "open")}`) })).toBeVisible();
});

test("MATCO-Seiten sind nicht zutreffend, Canopy-Seiten älterer Versionen fallen weg, Wig-Wag-Seite ist zu klären", async ({ page }) => {
  const projectId = await login();
  await page.goto(`/p/${projectId}/manuals/undercarriage`);
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(1, "not_applicable")}`) })).toBeVisible();
  await page.goto(`/p/${projectId}/manuals/canopy`);
  await expect(page.getByRole("button", { name: new RegExp(`^${chipName(7, "not_applicable")}`) })).toBeVisible();
  await page.goto(`/p/${projectId}/manuals/wing`);
  // Status von Seite 22 hängt vom importierten Stand ab (CI: offen, lokal: erledigt); nur die Markierung «klären» zählt.
  await expect(page.getByRole("button", { name: new RegExp(`^Seite 22: .*${manual.chip.clarify}`) })).toBeVisible();
});

test("Zusatzarbeit anlegen, erledigen, löschen", async ({ page }) => {
  const projectId = await login();
  await page.goto(`/p/${projectId}/tasks`);
  const title = `E2E Testarbeit ${Date.now()}`;
  await page.getByText(tasks.form.newTitle, { exact: true }).first().click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: tasks.form.submit }) }).first();
  await form.getByLabel(tasks.form.title).fill(title);
  await form.getByLabel(tasks.form.category).fill("E2E");
  await form.getByRole("button", { name: tasks.form.submit }).click();
  await expect(page.getByText(title)).toBeVisible();
  // Erst navigieren, wenn die Server Action (Erledigen) geantwortet hat; sonst bricht der Seitenwechsel sie ab.
  const toggled = page.waitForResponse((r) => r.request().method() === "POST" && r.ok());
  await page.getByRole("checkbox", { name: tasks.item.markDone.replace("{title}", title) }).click();
  await toggled;
  await page.goto(`/p/${projectId}/tasks?filter=done`);
  const item = page.locator("li, article, div").filter({ hasText: title }).last();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: tasks.item.delete }).first().click();
  await item.getByRole("button", { name: tasks.item.confirmYes }).first().click();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("Konfiguration: Bremsenwechsel zeigt die Auswirkung und lässt sich abbrechen", async ({ page }) => {
  const projectId = await login();
  await page.goto(`/p/${projectId}/setup?step=brakes`);
  await page.getByRole("radio", { name: /MATCO/ }).click();
  await expect(page.getByText(setup.preview.title)).toBeVisible();
  await expect(page.getByText(/Seiten kommen dazu/)).toBeVisible();
  await page.getByRole("button", { name: setup.preview.cancel }).click();
  await expect(page.getByText(setup.preview.title)).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Beringer/ })).toHaveAttribute("aria-checked", "true");
});
