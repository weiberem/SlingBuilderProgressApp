import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Smoke-Test: Anmelden und das Dashboard des (einzigen) Projekts sehen.
 * Texte kommen aus messages/de, Zugangsdaten aus der Umgebung (E2E_* oder SEED_ADMIN_*).
 * Ein Kennzeichen wird nicht hartkodiert: E2E_REGISTRATION ist optional, sonst genügt das Muster.
 */
const email = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

const messages = (ns: string) => JSON.parse(readFileSync(path.join(process.cwd(), "messages", "de", `${ns}.json`), "utf8"));
const auth = messages("auth");
const common = messages("common");
const progress = messages("progress");

test.beforeEach(() => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD oder SEED_ADMIN_* fehlen");
});

test("Anmelden und Dashboard sehen", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: auth.login.title })).toBeVisible();

  await page.getByLabel(auth.login.email).fill(email!);
  await page.getByLabel(auth.login.password).fill(password!);
  await page.getByRole("button", { name: auth.login.submit }).click();

  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);

  const registration = page.getByRole("heading", { level: 1 });
  await expect(registration).toBeVisible();
  const expected = process.env.E2E_REGISTRATION;
  if (expected) await expect(registration).toHaveText(expected);
  else await expect(registration).toHaveText(/^[A-Z0-9]{1,2}-[A-Z0-9]{1,5}$/);

  await expect(page.getByRole("heading", { level: 2, name: progress.dashboard.manuals })).toBeVisible();
  await expect(page.getByRole("link", { name: common.nav.settings }).first()).toBeVisible();
});

test("Ohne Session wird auf /login umgeleitet", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
});
