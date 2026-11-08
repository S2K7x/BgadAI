/**
 * Real product photos bundled with the app (public/samples, built by scripts/fetch-samples.mjs
 * from the MIT-licensed "Fashion Product Images" dataset). Used for style-quiz looks, heroes,
 * missing-piece thumbnails and the one-tap sample closet.
 */
import catalogJson from "./sampleCatalog.json";
import { hexToRgb, rgbDistance } from "./colors";
import { categoryOf, COLORS, type Category, type ColorName, type Pattern, type Season, type Style, type Subcategory } from "./taxonomy";

export type SamplePiece = {
  key: string;
  src: string;
  name: string;
  category: Category;
  subcategory: Subcategory;
  colors: ColorName[];
  pattern: Pattern;
  formality: number;
  warmth: number;
  seasons: Season[];
  styles: Style[];
  gender: "m" | "w" | "u";
  source: { dataset: string; id: number; title: string };
};

export const SAMPLES = catalogJson as SamplePiece[];

const colorDist = (a: ColorName, b: ColorName) => (a === b ? 0 : rgbDistance(hexToRgb(COLORS[a]), hexToRgb(COLORS[b])));

/**
 * Best photo for a (type, colour): same subcategory first, then same category,
 * nearest colour, preferring the requested wardrobe.
 */
export function findSample(sub: string, color: ColorName, wardrobe?: "womenswear" | "menswear" | "both"): SamplePiece | undefined {
  const cat = categoryOf(sub);
  const want = wardrobe === "womenswear" ? "w" : wardrobe === "menswear" ? "m" : undefined;
  let best: SamplePiece | undefined;
  let bestScore = Infinity;
  for (const s of SAMPLES) {
    if (s.category !== cat) continue;
    let score = colorDist(s.colors[0], color);
    if (s.subcategory !== sub) score += 400;
    if (want && s.gender !== "u" && s.gender !== want) score += 60;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** Pieces for the one-tap sample closet, filtered to the user's wardrobe. */
export function sampleCloset(wardrobe: "womenswear" | "menswear" | "both"): SamplePiece[] {
  if (wardrobe === "both") return SAMPLES.filter((s) => s.gender === "u" || CORE_BOTH.has(s.key));
  const g = wardrobe === "womenswear" ? "w" : "m";
  return SAMPLES.filter((s) => s.gender === "u" || s.gender === g);
}

const CORE_BOTH = new Set([
  "tee-white", "tee-black", "shirt-white", "sweater-navy", "sweater-beige", "hoodie-grey",
  "jeans-blue", "jeans-black", "trousers-black", "chinos-beige", "skirt-black", "dress-black", "blazer-navy",
]);
