/**
 * Renders the brand assets in web/public/:
 *   - og-image.png (1200x630, from og-image.svg with self-hosted fonts)
 *   - apple-touch-icon.png (180), icon-192.png, icon-512.png, favicon-32.png (from favicon.svg)
 *   - favicon.ico (ICO container wrapping the 32px PNG)
 *
 * Manual step — not wired into the build. Run from web/:
 *   node scripts/render-brand-assets.mjs
 * Requires Playwright (`npx playwright install chromium`).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const publicDir = path.join(webDir, "public");

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    // Fall back to the npx cache used for UI screenshots in this environment.
    const cached =
      "/Users/montimage/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
    try {
      return (await import(pathToFileURL(path.join(cached, "index.mjs")).href))
        .chromium;
    } catch {
      console.error(
        "Playwright not found. Install it with: npm i -D playwright && npx playwright install chromium",
      );
      process.exit(1);
    }
  }
}

function fontFace(family, weight, relPath) {
  return { family, weight, relPath };
}

const fonts = [
  fontFace(
    "Bricolage Grotesque Variable",
    "100 900",
    "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  ),
  fontFace(
    "Instrument Sans Variable",
    "100 900",
    "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  ),
  fontFace(
    "IBM Plex Mono",
    "400",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  ),
  fontFace(
    "IBM Plex Mono",
    "500",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
  ),
  fontFace(
    "IBM Plex Mono",
    "600",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2",
  ),
];

async function fontFaceCss() {
  const blocks = await Promise.all(
    fonts.map(async ({ family, weight, relPath }) => {
      const bytes = await readFile(path.join(webDir, "node_modules", relPath));
      return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: block; src: url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2'); }`;
    }),
  );
  return blocks.join("\n");
}

function pageHtml(svgMarkup) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>\n${fontCss}\nhtml, body { margin: 0; padding: 0; background: transparent; }</style></head><body>${svgMarkup}</body></html>`;
}

function sizedSvg(svg, size) {
  return svg.replace("<svg", `<svg width="${size}" height="${size}"`);
}

const chromium = await loadChromium();
const fontCss = await fontFaceCss();
const ogSvg = await readFile(path.join(publicDir, "og-image.svg"), "utf8");
const faviconSvg = await readFile(path.join(publicDir, "favicon.svg"), "utf8");
const browser = await chromium.launch();

try {
  // OG image: 1200x630 PNG, deviceScaleFactor 1.
  const ogPage = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await ogPage.setContent(pageHtml(ogSvg), { waitUntil: "load" });
  await ogPage.evaluate(() => document.fonts.ready);
  await ogPage.screenshot({ path: path.join(publicDir, "og-image.png") });
  await ogPage.close();

  // Icons rendered from favicon.svg.
  const iconTargets = [
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["favicon-32.png", 32],
  ];
  for (const [name, size] of iconTargets) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(pageHtml(sizedSvg(faviconSvg, size)), {
      waitUntil: "load",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(publicDir, name) });
    await page.close();
  }
} finally {
  await browser.close();
}

// favicon.ico: ICONDIR + one ICONDIRENTRY + the 32px PNG bytes.
const png32 = await readFile(path.join(publicDir, "favicon-32.png"));
const ico = Buffer.alloc(22 + png32.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // image count
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt8(0, 8); // palette colors
ico.writeUInt8(0, 9); // reserved
ico.writeUInt16LE(1, 10); // color planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png32.length, 14); // image data size
ico.writeUInt32LE(22, 18); // image data offset
png32.copy(ico, 22);
await writeFile(path.join(publicDir, "favicon.ico"), ico);

console.log("Wrote og-image.png, icons, and favicon.ico to web/public/");
