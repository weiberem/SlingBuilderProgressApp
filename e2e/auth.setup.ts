import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { authFile, projectFile, messages } from "./helpers";

/**
 * Einmalige Anmeldung für alle E2E-Tests (die Login-Bremse erlaubt 10 Versuche pro 15 Minuten,
 * deshalb nicht in jedem Test neu anmelden). Speichert Cookies und die Projekt-ID.
 */
const email = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const auth = messages("auth");

setup("anmelden", async ({ page }) => {
  setup.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD oder SEED_ADMIN_* fehlen");
  await page.goto("/login");
  await page.getByLabel(auth.login.email).fill(email!);
  await page.getByLabel(auth.login.password).fill(password!);
  await page.getByRole("button", { name: auth.login.submit }).click();
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/);
  const projectId = page.url().match(/\/p\/([0-9a-f-]{36})/)![1];
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
  writeFileSync(projectFile, JSON.stringify({ projectId }));
});
