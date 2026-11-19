// Renders Grid's app icons (a violet orb critter) to PNG with Playwright's Chromium.
// Run: node scripts/icons.mjs   (from apps/web)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const out = path.resolve(import.meta.dirname, "../public/icons");
mkdirSync(out, { recursive: true });

/** `scale` < 1 keeps the critter inside the maskable safe zone. */
function svg(size, scale) {
  const r = 0.34 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1 1">
  <defs>
    <linearGradient id="g" x1="0.2" y1="0.1" x2="0.8" y2="0.95">
      <stop offset="0" stop-color="oklch(0.73 0.2 295)"/>
      <stop offset="0.55" stop-color="oklch(0.6 0.2 295)"/>
      <stop offset="1" stop-color="oklch(0.48 0.2 295)"/>
    </linearGradient>
    <clipPath id="c"><circle cx="0.5" cy="0.53" r="${r}"/></clipPath>
  </defs>
  <rect width="1" height="1" fill="#121110"/>
  <circle cx="0.5" cy="0.53" r="${r}" fill="url(#g)"/>
  <ellipse cx="${0.5 - r * 0.36}" cy="${0.53 - r * 0.44}" rx="${r * 0.34}" ry="${r * 0.18}" fill="#fff" opacity="0.25" transform="rotate(-28 ${0.5 - r * 0.36} ${0.53 - r * 0.44})" clip-path="url(#c)"/>
  <g fill="#1b1a1f">
    <circle cx="${0.5 - r * 0.36}" cy="${0.53 - r * 0.1}" r="${r * 0.11}"/>
    <circle cx="${0.5 + r * 0.36}" cy="${0.53 - r * 0.1}" r="${r * 0.11}"/>
  </g>
  <g fill="#fff">
    <circle cx="${0.5 - r * 0.32}" cy="${0.53 - r * 0.14}" r="${r * 0.035}"/>
    <circle cx="${0.5 + r * 0.4}" cy="${0.53 - r * 0.14}" r="${r * 0.035}"/>
  </g>
  <g fill="oklch(0.72 0.16 12)" opacity="0.4">
    <ellipse cx="${0.5 - r * 0.56}" cy="${0.53 + r * 0.11}" rx="${r * 0.11}" ry="${r * 0.06}"/>
    <ellipse cx="${0.5 + r * 0.56}" cy="${0.53 + r * 0.11}" rx="${r * 0.11}" ry="${r * 0.06}"/>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, scale] of [
  ["icon-192.png", 192, 1.25],
  ["icon-512.png", 512, 1.25],
  ["maskable-512.png", 512, 0.95],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
  await page.locator("svg").screenshot({ path: path.join(out, name) });
  console.log("wrote", name);
}
await browser.close();
