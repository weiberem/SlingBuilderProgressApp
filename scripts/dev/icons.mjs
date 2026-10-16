// Erzeugt die PWA-Icons aus dem Logo-SVG (Logo auf Nachtschwarz), Aufruf: node scripts/dev/icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync("public/brand/sling-aircraft-logo.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
async function render(size, scale, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#0a0a0c;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px"><div style="width:${Math.round(size * scale)}px">${svg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="auto"')}</div></body></html>`);
  const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(file, buf);
}
await render(512, 0.84, "public/icons/icon-512.png");
await render(192, 0.84, "public/icons/icon-192.png");
await render(512, 0.62, "public/icons/maskable-512.png");
await render(192, 0.62, "public/icons/maskable-192.png");
await render(180, 0.84, "public/icons/apple-touch-icon.png");
await browser.close();
console.log("icons ok");
