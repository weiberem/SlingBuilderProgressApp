import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright-E2E: startet `next dev` auf Port 3105 gegen die Datenbank aus .env (DATABASE_URL).
 * Zugangsdaten: E2E_EMAIL/E2E_PASSWORD, sonst SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD (pnpm seed).
 *   pnpm test:e2e            alle Projekte (Desktop + Mobil)
 *   pnpm test:e2e --ui       interaktiv
 */
const PORT = Number(process.env.E2E_PORT ?? 3105);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Optional: vorhandenes Chromium statt des von Playwright heruntergeladenen (z. B. E2E_CHROMIUM_PATH=/opt/pw-browsers/.../chrome).
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" }, dependencies: ["setup"] },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], storageState: "e2e/.auth/user.json" }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
