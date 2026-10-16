import { chromium } from "@playwright/test";
const base = "http://localhost:3105";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "de-CH" });
  const page = await ctx.newPage();
  await page.goto(base + "/login");
  await page.fill('input[name="email"]', "remy.weibel@gmail.com");
  await page.fill('input[name="password"]', "change-me-now");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/p\//);
  const projectId = page.url().split("/p/")[1].split(/[/?]/)[0];
  await page.goto(base + `/p/${projectId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-dashboard.png`, fullPage: true });
  if (name === "desktop") {
    const res = await ctx.request.get(base + `/api/p/${projectId}/export.json`);
    const json = await res.json();
    console.log("export", res.status(), res.headers()["content-disposition"], "pageStatus:", json.pageStatus.length, "tasks:", json.extraTasks.length, "audit:", json.auditLog.length, "doneAt null:", json.pageStatus.filter((p) => p.doneAt === null).length);
    await page.goto(base + `/p/${projectId}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${name}-dashboard-exported.png`, fullPage: true });
    await page.goto(base + `/p/${projectId}/manuals/canopy`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${name}-canopy.png`, fullPage: false });
  }
  await ctx.close();
}
await browser.close();
