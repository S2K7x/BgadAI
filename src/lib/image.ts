"use client";
/** Client-side image utilities: resize/compress, crop, colour extraction, background removal. */
import { nearestColorName, type RGB } from "./colors";
import type { ColorName } from "./taxonomy";

export async function loadBitmap(src: Blob): Promise<ImageBitmap> {
  return createImageBitmap(src, { imageOrientation: "from-image" });
}

function canvasFor(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type = "image/webp", quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), type, quality),
  );
}

/**
 * Resize so the longest side is at most `max` px and re-encode (strips EXIF/GPS too).
 * `box` is an optional normalised crop [x0, y0, x1, y1].
 */
export async function resizeImage(
  src: Blob,
  max: number,
  opts: { type?: string; quality?: number; box?: [number, number, number, number]; pad?: number } = {},
): Promise<Blob> {
  const bmp = await loadBitmap(src);
  let [sx, sy, sw, sh] = [0, 0, bmp.width, bmp.height];
  if (opts.box) {
    const pad = opts.pad ?? 0.03;
    const [x0, y0, x1, y1] = opts.box;
    sx = Math.max(0, (x0 - pad) * bmp.width);
    sy = Math.max(0, (y0 - pad) * bmp.height);
    sw = Math.min(bmp.width - sx, (x1 - x0 + 2 * pad) * bmp.width);
    sh = Math.min(bmp.height - sy, (y1 - y0 + 2 * pad) * bmp.height);
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const c = canvasFor(Math.round(sw * scale), Math.round(sh * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  bmp.close();
  return toBlob(c, opts.type ?? "image/webp", opts.quality ?? 0.86);
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Dominant garment colours using k-means on pixels, ignoring transparent pixels
 * and pixels that look like the background (estimated from the image border).
 */
export async function extractColors(src: Blob, k = 4): Promise<ColorName[]> {
  const bmp = await loadBitmap(src);
  const size = 72;
  const scale = size / Math.max(bmp.width, bmp.height);
  const c = canvasFor(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  // Background estimate from border pixels.
  const border: RGB[] = [];
  let transparent = 0;
  for (let x = 0; x < width; x++) for (const y of [0, height - 1]) border.push(px(data, width, x, y));
  for (let y = 0; y < height; y++) for (const x of [0, width - 1]) border.push(px(data, width, x, y));
  const bg = mean(border);

  const pts: RGB[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) {
        transparent++;
        continue;
      }
      const p: RGB = [data[i], data[i + 1], data[i + 2]];
      // If the photo has an opaque background, skip pixels close to it.
      if (transparent === 0 && dist(p, bg) < 38) continue;
      pts.push(p);
    }
  }
  const sample = pts.length > 50 ? pts : border;
  const clusters = kmeans(sample, Math.min(k, sample.length));
  const total = clusters.reduce((a, cl) => a + cl.count, 0);
  const named = new Map<ColorName, number>();
  for (const cl of clusters) {
    const n = nearestColorName(cl.center);
    named.set(n, (named.get(n) ?? 0) + cl.count / total);
  }
  return [...named.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, share], idx) => idx === 0 || share > 0.15)
    .slice(0, 3)
    .map(([n]) => n);
}

function px(d: Uint8ClampedArray, w: number, x: number, y: number): RGB {
  const i = (y * w + x) * 4;
  return [d[i], d[i + 1], d[i + 2]];
}
function mean(ps: RGB[]): RGB {
  const s = ps.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as RGB, [0, 0, 0] as RGB);
  return [s[0] / ps.length, s[1] / ps.length, s[2] / ps.length];
}
function dist(a: RGB, b: RGB) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function kmeans(points: RGB[], k: number, iters = 10) {
  let centers: RGB[] = Array.from({ length: k }, (_, i) => points[Math.floor((i + 0.5) * (points.length / k))]);
  let assign = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    assign = points.map((p) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, ci) => {
        const d = dist(p, c);
        if (d < bd) { bd = d; bi = ci; }
      });
      return bi;
    });
    centers = centers.map((c, ci) => {
      const mine = points.filter((_, pi) => assign[pi] === ci);
      return mine.length ? mean(mine) : c;
    });
  }
  return centers.map((center, ci) => ({ center, count: assign.filter((a) => a === ci).length }));
}

/* ------------------------------------------------------------------ */
/* On-device background removal (BiRefNet lite, MIT) via Transformers.js */
/* Loaded from a CDN on first use so it doesn't bloat the app bundle.   */
/* ------------------------------------------------------------------ */

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
const BG_MODEL = "onnx-community/BiRefNet_lite-ONNX";

type Segmenter = (input: string) => Promise<{ toCanvas(): HTMLCanvasElement } | { toCanvas(): HTMLCanvasElement }[]>;
let segmenterPromise: Promise<Segmenter> | null = null;

// Import from a URL at runtime without the bundler trying to resolve it.
const importFromUrl = new Function("u", "return import(u)") as (u: string) => Promise<Record<string, unknown>>;

export function loadBackgroundRemover(onProgress?: (pct: number) => void): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const tf = (await importFromUrl(TRANSFORMERS_URL)) as {
        pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Segmenter>;
      };
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
      const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
      const hasWebGPU = !!adapter;
      const hasF16 = !!adapter?.features.has("shader-f16");
      const progress_callback = (e: { status: string; progress?: number }) => {
        if (e.status === "progress" && typeof e.progress === "number") onProgress?.(e.progress);
      };
      try {
        return await tf.pipeline("background-removal", BG_MODEL, {
          device: hasWebGPU ? "webgpu" : "wasm",
          // The model ships fp32 and fp16 weights only (no quantised variants); fp16 needs shader-f16.
          dtype: hasF16 ? "fp16" : "fp32",
          progress_callback,
        });
      } catch {
        return await tf.pipeline("background-removal", BG_MODEL, { device: "wasm", dtype: "fp32", progress_callback });
      }
    })().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

/** Returns a WebP with a transparent background, or throws. */
export async function removeBackground(src: Blob, onProgress?: (pct: number) => void): Promise<Blob> {
  const seg = await loadBackgroundRemover(onProgress);
  const url = URL.createObjectURL(src);
  try {
    const out = await seg(url);
    const img = Array.isArray(out) ? out[0] : out;
    const canvas = img.toCanvas();
    return await trimTransparent(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Crop away fully transparent margins so the garment fills the frame. */
async function trimTransparent(src: HTMLCanvasElement): Promise<Blob> {
  const ctx = src.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return toBlob(src);
  const pad = Math.round(Math.max(width, height) * 0.03);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = canvasFor(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return toBlob(out);
}

/** Load the model and run one tiny cut-out to prove this device can actually execute it. */
export async function verifyBackgroundRemoval(onProgress?: (pct: number) => void): Promise<void> {
  await loadBackgroundRemover(onProgress);
  const c = canvasFor(96, 96);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e8e3dc";
  ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = "#1f2e4d";
  ctx.fillRect(28, 16, 40, 64);
  await removeBackground(await toBlob(c, "image/png"));
}
