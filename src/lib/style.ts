/**
 * Style onboarding: a "Style Shuffle" deck of looks spanning the archetypes.
 * Likes/dislikes become archetype weights (shown to the user as their style mix).
 */
import { STYLES, type ColorName, type Style, type Subcategory } from "./taxonomy";

export type LookPiece = { sub: Subcategory; color: ColorName };
export type Look = {
  id: string;
  title: string;
  styles: Partial<Record<Style, number>>;
  pieces: LookPiece[];
  for: "womenswear" | "menswear" | "both";
};

export const LOOKS: Look[] = [
  { id: "min-1", title: "Crisp white tee, black trousers, white sneakers", styles: { minimal: 1, classic: 0.3 }, for: "both",
    pieces: [{ sub: "t-shirt", color: "white" }, { sub: "trousers", color: "black" }, { sub: "sneakers", color: "white" }] },
  { id: "min-2", title: "Oatmeal knit, cream wide trousers, loafers", styles: { minimal: 1, classic: 0.4 }, for: "both",
    pieces: [{ sub: "sweater", color: "beige" }, { sub: "trousers", color: "cream" }, { sub: "loafers", color: "brown" }] },
  { id: "min-3", title: "Grey long coat over all-black", styles: { minimal: 0.9, edgy: 0.3 }, for: "both",
    pieces: [{ sub: "coat", color: "grey" }, { sub: "long-sleeve", color: "black" }, { sub: "trousers", color: "black" }, { sub: "boots", color: "black" }] },
  { id: "cla-1", title: "Camel trench, navy knit, straight jeans", styles: { classic: 1, minimal: 0.3 }, for: "both",
    pieces: [{ sub: "trench", color: "camel" }, { sub: "sweater", color: "navy" }, { sub: "jeans", color: "denim" }, { sub: "loafers", color: "brown" }] },
  { id: "cla-2", title: "Navy blazer, light-blue shirt, beige chinos", styles: { classic: 1, preppy: 0.5 }, for: "both",
    pieces: [{ sub: "blazer", color: "navy" }, { sub: "shirt", color: "light-blue" }, { sub: "chinos", color: "beige" }, { sub: "dress-shoes", color: "brown" }] },
  { id: "cla-3", title: "Little black dress and heels", styles: { classic: 1, romantic: 0.4 }, for: "womenswear",
    pieces: [{ sub: "dress", color: "black" }, { sub: "heels", color: "black" }, { sub: "clutch", color: "metallic" }] },
  { id: "str-1", title: "Oversized hoodie, cargo joggers, chunky sneakers", styles: { streetwear: 1, sporty: 0.4 }, for: "both",
    pieces: [{ sub: "hoodie", color: "grey" }, { sub: "joggers", color: "olive" }, { sub: "sneakers", color: "white" }] },
  { id: "str-2", title: "Graphic tee, baggy jeans, cap", styles: { streetwear: 1 }, for: "both",
    pieces: [{ sub: "t-shirt", color: "black" }, { sub: "jeans", color: "light-blue" }, { sub: "sneakers", color: "red" }, { sub: "cap", color: "black" }] },
  { id: "str-3", title: "Puffer jacket, sweatshirt, sneakers", styles: { streetwear: 0.9, sporty: 0.5 }, for: "both",
    pieces: [{ sub: "puffer", color: "black" }, { sub: "sweatshirt", color: "green" }, { sub: "joggers", color: "black" }, { sub: "sneakers", color: "white" }] },
  { id: "spo-1", title: "Matching tracksuit and running shoes", styles: { sporty: 1, streetwear: 0.3 }, for: "both",
    pieces: [{ sub: "sweatshirt", color: "navy" }, { sub: "joggers", color: "navy" }, { sub: "sneakers", color: "grey" }] },
  { id: "spo-2", title: "Tank, leggings, light zip jacket", styles: { sporty: 1 }, for: "womenswear",
    pieces: [{ sub: "jacket", color: "pink" }, { sub: "tank", color: "black" }, { sub: "leggings", color: "black" }, { sub: "sneakers", color: "white" }] },
  { id: "boh-1", title: "Floral maxi dress with sandals", styles: { boho: 1, romantic: 0.6 }, for: "womenswear",
    pieces: [{ sub: "dress", color: "orange" }, { sub: "sandals", color: "brown" }, { sub: "hat", color: "beige" }] },
  { id: "boh-2", title: "Linen shirt, wide trousers, earthy tones", styles: { boho: 1, minimal: 0.3 }, for: "both",
    pieces: [{ sub: "shirt", color: "cream" }, { sub: "trousers", color: "khaki" }, { sub: "sandals", color: "brown" }] },
  { id: "boh-3", title: "Suede jacket, printed blouse, flared jeans", styles: { boho: 1 }, for: "womenswear",
    pieces: [{ sub: "jacket", color: "camel" }, { sub: "blouse", color: "burgundy" }, { sub: "jeans", color: "denim" }, { sub: "boots", color: "brown" }] },
  { id: "pre-1", title: "Cable knit over collared shirt, pleated skirt", styles: { preppy: 1, classic: 0.4 }, for: "womenswear",
    pieces: [{ sub: "sweater", color: "cream" }, { sub: "skirt", color: "navy" }, { sub: "loafers", color: "black" }] },
  { id: "pre-2", title: "Polo, chino shorts, boat shoes", styles: { preppy: 1, classic: 0.3 }, for: "menswear",
    pieces: [{ sub: "polo", color: "green" }, { sub: "shorts", color: "beige" }, { sub: "loafers", color: "brown" }] },
  { id: "pre-3", title: "Striped shirt, cardigan, chinos", styles: { preppy: 1 }, for: "both",
    pieces: [{ sub: "cardigan", color: "burgundy" }, { sub: "shirt", color: "light-blue" }, { sub: "chinos", color: "khaki" }, { sub: "sneakers", color: "white" }] },
  { id: "edg-1", title: "Leather jacket, black jeans, boots", styles: { edgy: 1, streetwear: 0.3 }, for: "both",
    pieces: [{ sub: "leather-jacket", color: "black" }, { sub: "t-shirt", color: "grey" }, { sub: "jeans", color: "black" }, { sub: "boots", color: "black" }] },
  { id: "edg-2", title: "Band tee, mini skirt, combat boots", styles: { edgy: 1, streetwear: 0.4 }, for: "womenswear",
    pieces: [{ sub: "t-shirt", color: "black" }, { sub: "skirt", color: "black" }, { sub: "boots", color: "black" }] },
  { id: "edg-3", title: "Burgundy shirt, black trousers, chelsea boots", styles: { edgy: 0.8, classic: 0.4 }, for: "menswear",
    pieces: [{ sub: "shirt", color: "burgundy" }, { sub: "trousers", color: "black" }, { sub: "boots", color: "black" }] },
  { id: "rom-1", title: "Pink blouse, cream skirt, ballet flats", styles: { romantic: 1, preppy: 0.3 }, for: "womenswear",
    pieces: [{ sub: "blouse", color: "pink" }, { sub: "skirt", color: "cream" }, { sub: "flats", color: "beige" }] },
  { id: "rom-2", title: "Soft knit cardigan over a slip dress", styles: { romantic: 1, boho: 0.3 }, for: "womenswear",
    pieces: [{ sub: "cardigan", color: "cream" }, { sub: "dress", color: "light-blue" }, { sub: "flats", color: "white" }] },
  { id: "rom-3", title: "Pastel shirt, light chinos, suede loafers", styles: { romantic: 0.7, classic: 0.5 }, for: "menswear",
    pieces: [{ sub: "shirt", color: "pink" }, { sub: "chinos", color: "cream" }, { sub: "loafers", color: "camel" }] },
  { id: "mix-1", title: "Denim jacket, white tee, black jeans", styles: { streetwear: 0.4, classic: 0.4, minimal: 0.4 }, for: "both",
    pieces: [{ sub: "denim-jacket", color: "denim" }, { sub: "t-shirt", color: "white" }, { sub: "jeans", color: "black" }, { sub: "sneakers", color: "white" }] },
];

export function looksFor(wardrobe: "womenswear" | "menswear" | "both"): Look[] {
  return LOOKS.filter((l) => wardrobe === "both" || l.for === "both" || l.for === wardrobe);
}

export function emptyWeights(): Record<Style, number> {
  return Object.fromEntries(STYLES.map((s) => [s, 0])) as Record<Style, number>;
}

/**
 * Compute normalised archetype weights from swipes.
 * like = +1, love = +2, dislike = -0.6. Negative totals are clipped to 0.
 */
export function weightsFromSwipes(swipes: { look: Look; value: number }[]): Record<Style, number> {
  const w = emptyWeights();
  for (const { look, value } of swipes) {
    for (const [s, v] of Object.entries(look.styles) as [Style, number][]) w[s] += v * value;
  }
  return normalise(w);
}

export function normalise(w: Record<Style, number>): Record<Style, number> {
  const clipped = Object.fromEntries(STYLES.map((s) => [s, Math.max(0, w[s] ?? 0)])) as Record<Style, number>;
  const sum = Object.values(clipped).reduce((a, b) => a + b, 0);
  if (sum <= 0) return Object.fromEntries(STYLES.map((s) => [s, 1 / STYLES.length])) as Record<Style, number>;
  return Object.fromEntries(STYLES.map((s) => [s, clipped[s] / sum])) as Record<Style, number>;
}

export function topStyles(w: Record<Style, number>, n = 3): { style: Style; pct: number }[] {
  return (Object.entries(w) as [Style, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .filter(([, v]) => v > 0.02)
    .map(([style, v]) => ({ style, pct: Math.round(v * 100) }));
}
