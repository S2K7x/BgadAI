import { COLORS, NEUTRALS, type ColorName } from "./taxonomy";

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/** Perceptual-ish distance in RGB using the "redmean" approximation. */
export function rgbDistance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const PALETTE = (Object.entries(COLORS) as [ColorName, string][])
  .filter(([n]) => n !== "metallic")
  .map(([name, hex]) => ({ name, rgb: hexToRgb(hex) }));

export function nearestColorName(rgb: RGB): ColorName {
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = rgbDistance(rgb, p.rgb);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.name;
}

export function hueOf(name: ColorName): number {
  return rgbToHsl(hexToRgb(COLORS[name]))[0];
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export type HarmonyResult = { score: number; note: string };

/**
 * Score how well a set of colours work together (0…1).
 * Rules of thumb used by stylists: neutrals go with everything; one accent colour is
 * safest; two accents work if analogous (close on the wheel) or complementary
 * (opposite); three or more accents is busy.
 */
export function colorHarmony(colors: ColorName[]): HarmonyResult {
  const unique = [...new Set(colors)];
  const accents = unique.filter((c) => !NEUTRALS.has(c));
  const neutrals = unique.filter((c) => NEUTRALS.has(c));

  if (accents.length === 0) {
    if (neutrals.length <= 1) return { score: 0.8, note: "Monochrome look — sleek and easy" };
    if (neutrals.includes("black") && neutrals.includes("navy") && neutrals.length === 2)
      return { score: 0.7, note: "Navy and black is a subtle, tonal pairing" };
    return { score: 0.9, note: `All neutrals (${neutrals.slice(0, 3).join(", ")}) — always works` };
  }
  if (accents.length === 1) {
    return { score: 1, note: `A single pop of ${accents[0]} grounded by neutrals` };
  }
  if (accents.length === 2) {
    const gap = hueGap(hueOf(accents[0]), hueOf(accents[1]));
    if (gap <= 45) return { score: 0.85, note: `${accents[0]} and ${accents[1]} are analogous — harmonious` };
    if (gap >= 150) return { score: 0.75, note: `${accents[0]} and ${accents[1]} are complementary — bold contrast` };
    return { score: 0.35, note: `${accents[0]} and ${accents[1]} may clash` };
  }
  return { score: Math.max(0.1, 0.4 - (accents.length - 3) * 0.1), note: "Lots of colours — quite busy" };
}
