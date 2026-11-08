// Renders promo.html frame-by-frame into an H.264 MP4 (piped straight into ffmpeg).
// Usage: node marketing/tools/render.mjs <rawDir> <out.mp4> [9x16|16x9] [fps] [--preview t1,t2,...]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const [rawDir, out, format = "9x16", fpsArg = "30", flag, previewTimes] = process.argv.slice(2);
const fps = Number(fpsArg);
const [W, H] = format === "16x9" ? [1920, 1080] : [1080, 1920];
const samples = path.resolve(here, "../../public/samples");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(`file://${here}/promo.html#format=${format}&raw=${path.resolve(rawDir)}&samples=${samples}`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

if (flag === "--preview") {
  // Stills at chosen times, for checking layouts without encoding a video.
  for (const t of previewTimes.split(",").map(Number)) {
    await page.evaluate((x) => window.renderAt(x), t);
    await page.screenshot({ path: out.replace(/\.png$/, `-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  out,
], { stdio: ["pipe", "inherit", "inherit"] });

const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  await page.evaluate((x) => window.renderAt(x), i / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 5) === 0) console.log(`frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`wrote ${out} (${duration.toFixed(1)}s @ ${fps}fps)`);
