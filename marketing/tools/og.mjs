// Renders the OpenGraph link preview (1200x630) into the app, plus a 2x README banner.
// Usage: node marketing/tools/og.mjs <rawDir>
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.resolve(process.argv[2]);
const browser = await chromium.launch();
for (const [scale, out] of [[1, "src/app/opengraph-image.png"], [2, "marketing/screenshots/banner.png"]]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: scale });
  await page.goto(`file://${here}/og.html#raw=${rawDir}`);
  await page.evaluate(() => window.ready);
  await page.screenshot({ path: path.resolve(here, "../..", out) });
  await page.close();
}
await browser.close();
console.log("wrote opengraph-image.png and banner.png");
