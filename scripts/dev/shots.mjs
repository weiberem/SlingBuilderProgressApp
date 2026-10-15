import { chromium } from "@playwright/test";
const base = "http://localhost:3105";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "de-CH" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto(base + "/login");
  await page.fill('input[name="email"]', "remy.weibel@gmail.com");
  await page.fill('input[name="password"]', "change-me-now");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/p\//);
  const projectId = page.url().split("/p/")[1].split(/[/?]/)[0];
  const shots = {
    dashboard: `/p/${projectId}`,
    wing: `/p/${projectId}/manuals/wing`,
    undercarriage: `/p/${projectId}/manuals/undercarriage`,
    fuselage: `/p/${projectId}/manuals/fuselage`,
    tasks: `/p/${projectId}/tasks`,
    parts: `/p/${projectId}/parts`,
    setup: `/p/${projectId}/setup`,
    setupBrakes: `/p/${projectId}/setup?step=brakes`,
    admin: `/admin/manuals`,
    settings: `/settings`,
  };
  for (const [k, url] of Object.entries(shots)) {
    await page.goto(base + url, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${name}-${k}.png`, fullPage: k !== "wing" && k !== "setup" });
  }
  // Seitendetail: erster Chip der Wing-Ansicht → Seite
  await page.goto(base + `/p/${projectId}/manuals/wing`, { waitUntil: "networkidle" });
  const link = `/p/${projectId}/pages/01a1418a-4982-75a6-afe8-14e7d2f53a27`;
  if (link) { await page.goto(base + link, { waitUntil: "networkidle" }); await page.screenshot({ path: `${out}/${name}-page.png`, fullPage: true }); }
  console.log(name, "console errors:", errors.length, errors.slice(0, 5));
  await ctx.close();
}
await browser.close();
