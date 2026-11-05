/** Match garments detected in an inspiration photo against the user's closet. */
import { hexToRgb, rgbDistance } from "./colors";
import { COLORS, type ColorName } from "./taxonomy";
import type { DetectedGarment } from "./types";
import type { EngineItem } from "./outfitEngine";

export const OWN_THRESHOLD = 0.62;

function colorSimilarity(a: ColorName[], b: ColorName[]): number {
  if (!a.length || !b.length) return 0.5;
  // Primary colours matter most.
  const pa = a[0], pb = b[0];
  if (pa === pb) return 1;
  if (b.includes(pa) || a.includes(pb)) return 0.75;
  const d = rgbDistance(hexToRgb(COLORS[pa]), hexToRgb(COLORS[pb]));
  // ~0 for identical, ~765 for black vs white.
  return Math.max(0, 1 - d / 260);
}

export function garmentSimilarity(g: DetectedGarment, item: EngineItem): number {
  if (g.category !== item.category) return 0;
  const sub = g.subcategory === item.subcategory ? 1 : 0.35;
  const color = colorSimilarity(g.colors, item.colors);
  const pattern = g.pattern === item.pattern ? 1 : g.pattern === "solid" || item.pattern === "solid" ? 0.3 : 0.6;
  const formality = 1 - Math.min(Math.abs(g.formality - item.formality), 4) / 4;
  const style = g.styles.some((s) => item.styles.includes(s)) ? 1 : 0.5;
  return sub * 0.36 + color * 0.34 + pattern * 0.1 + formality * 0.12 + style * 0.08;
}

export type GarmentMatch = {
  garment: DetectedGarment;
  best?: { item: EngineItem; score: number };
  alternatives: { item: EngineItem; score: number }[];
  owned: boolean;
};

export function matchInspiration(garments: DetectedGarment[], closet: EngineItem[]): GarmentMatch[] {
  const used = new Set<string>();
  return garments.map((garment) => {
    const ranked = closet
      .filter((i) => i.status !== "archived")
      .map((item) => ({ item, score: garmentSimilarity(garment, item) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = ranked.find((r) => !used.has(r.item.id)) ?? ranked[0];
    if (best) used.add(best.item.id);
    return {
      garment,
      best,
      alternatives: ranked.filter((r) => r !== best).slice(0, 4),
      owned: !!best && best.score >= OWN_THRESHOLD,
    };
  });
}

/** Text query for shopping a missing piece, e.g. "camel wool coat women". */
export function shoppingQuery(g: Pick<DetectedGarment, "colors" | "subcategory" | "pattern" | "description">, wardrobe: "womenswear" | "menswear" | "both") {
  const color = g.colors[0] && g.colors[0] !== "metallic" ? g.colors[0].replace("-", " ") : "";
  const pattern = g.pattern !== "solid" && g.pattern !== "texture" ? g.pattern : "";
  const sub = g.subcategory.replace("-", " ");
  const who = wardrobe === "womenswear" ? "women" : wardrobe === "menswear" ? "men" : "";
  return [color, pattern, sub, who].filter(Boolean).join(" ");
}

export function shoppingLinks(query: string) {
  const q = encodeURIComponent(query);
  return [
    { label: "Google Shopping", href: `https://www.google.com/search?tbm=shop&q=${q}` },
    { label: "Vinted (second-hand)", href: `https://www.vinted.com/catalog?search_text=${q}` },
    { label: "Pinterest ideas", href: `https://www.pinterest.com/search/pins/?q=${q}` },
  ];
}
