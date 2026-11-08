// Renders the Instagram carousel slides (1080x1350) from posts.html.
// Usage: node marketing/tools/posts.mjs <rawDir> <outDir>
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const [rawDir, outDir = "marketing/instagram"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const samples = path.resolve(here, "../../public/samples");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (let n = 1; n <= 8; n++) {
  await page.goto(`file://${here}/posts.html#slide=${n}&raw=${path.resolve(rawDir)}&samples=${samples}`);
  await page.reload(); // hash-only navigation doesn't re-run the script
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, `slide-${n}.png`) });
}
await browser.close();
console.log(`wrote 8 slides to ${outDir}`);
