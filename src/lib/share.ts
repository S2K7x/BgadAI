"use client";
/**
 * Shareable images, rendered on-device with <canvas> and sent through the native share sheet
 * (Web Share API with files) — or downloaded where sharing files isn't supported.
 */

type Piece = { blob?: Blob; src?: string };

const W = 1080;
const H = 1350;

function displayFont(): string {
  // next/font gives the display face a generated family name; read it from a rendered element.
  const el = document.querySelector(".display");
  return el ? getComputedStyle(el).fontFamily : "system-ui, sans-serif";
}

async function bitmap(p: Piece): Promise<ImageBitmap | null> {
  try {
    const blob = p.blob ?? (p.src ? await (await fetch(p.src)).blob() : undefined);
    return blob ? await createImageBitmap(blob) : null;
  } catch {
    return null;
  }
}

function contain(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  return { c, ctx };
}

function header(ctx: CanvasRenderingContext2D, title: string, subtitle?: string) {
  const font = displayFont();
  ctx.fillStyle = "#0b0b0b";
  ctx.font = `800 34px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillText("BGADAI", 64, 56);
  ctx.font = `800 76px ${font}`;
  ctx.fillText(title.toUpperCase().slice(0, 22), 64, 112);
  if (subtitle) {
    ctx.font = "500 28px system-ui, sans-serif";
    ctx.fillStyle = "#6d6d6d";
    wrapText(ctx, subtitle, 64, 200, W - 128, 34, 2);
  }
}

async function drawGrid(ctx: CanvasRenderingContext2D, pieces: Piece[], x: number, y: number, w: number, h: number) {
  const imgs = (await Promise.all(pieces.slice(0, 6).map(bitmap))).filter((b): b is ImageBitmap => !!b);
  const n = imgs.length;
  const cols = n <= 1 ? 1 : 2;
  const rows = Math.ceil(n / cols) || 1;
  const gap = 16;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  imgs.forEach((img, i) => {
    const cx = x + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = "#efefef";
    ctx.fillRect(cx, cy, cw, ch);
    ctx.globalCompositeOperation = "multiply"; // white studio backgrounds melt into the tile
    contain(ctx, img, cx + 12, cy + 12, cw - 24, ch - 24);
    ctx.globalCompositeOperation = "source-over";
  });
}

/** Word-wrap onto at most `maxLines`, ending with "…" if the text doesn't fit. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxW) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.split(" ").slice(0, -1).join(" ");
    shown[maxLines - 1] = `${last}…`;
  }
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
}

function footer(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, H - 96, W, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, H - 48);
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png"));

export async function outfitCard(title: string, subtitle: string, pieces: Piece[]): Promise<Blob> {
  const { c, ctx } = canvas();
  header(ctx, title, subtitle);
  await drawGrid(ctx, pieces, 64, 290, W - 128, H - 290 - 150);
  footer(ctx, "Styled from my own closet · BgadAI");
  return toBlob(c);
}

/** "Which one should I wear?" — two outfits side by side for friends to vote on. */
export async function pollCard(a: Piece[], b: Piece[]): Promise<Blob> {
  const { c, ctx } = canvas();
  header(ctx, "A or B?", "Help me pick today's outfit");
  const colW = (W - 128 - 32) / 2;
  await drawGrid(ctx, a, 64, 270, colW, H - 270 - 200);
  await drawGrid(ctx, b, 64 + colW + 32, 270, colW, H - 270 - 200);
  const font = displayFont();
  ctx.fillStyle = "#0b0b0b";
  ctx.font = `800 64px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillText("A", 64 + colW / 2 - 20, H - 186);
  ctx.fillText("B", 64 + colW + 32 + colW / 2 - 20, H - 186);
  footer(ctx, "Reply with A or B · BgadAI");
  return toBlob(c);
}

export async function statsCard(title: string, lines: [string, string][], pieces: Piece[]): Promise<Blob> {
  const { c, ctx } = canvas();
  header(ctx, title, "My style, wrapped");
  const font = displayFont();
  let y = 280;
  for (const [value, label] of lines.slice(0, 5)) {
    ctx.fillStyle = "#0b0b0b";
    ctx.font = `800 64px ${font}`;
    ctx.textBaseline = "top";
    ctx.fillText(value.toUpperCase().slice(0, 18), 64, y);
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillStyle = "#6d6d6d";
    ctx.fillText(label.toUpperCase(), 64, y + 74);
    y += 136;
  }
  if (pieces.length) await drawGrid(ctx, pieces.slice(0, 1), 640, 300, 376, 560);
  footer(ctx, "bgadai · styled for you");
  return toBlob(c);
}

/** Share via the native sheet when files are supported; otherwise download. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
