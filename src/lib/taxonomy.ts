/**
 * Fixed wardrobe taxonomy. AI tagging is constrained to exactly these values so
 * every tag maps 1:1 onto a filter in the UI (a common complaint about other
 * wardrobe apps is auto-tags that don't line up with the filters).
 */

export const CATEGORIES = [
  "top",
  "bottom",
  "onepiece",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  onepiece: "Dresses & jumpsuits",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
};

export const SUBCATEGORIES = {
  top: ["t-shirt", "long-sleeve", "shirt", "blouse", "polo", "tank", "sweater", "hoodie", "sweatshirt", "cardigan"],
  bottom: ["jeans", "trousers", "chinos", "shorts", "skirt", "joggers", "leggings"],
  onepiece: ["dress", "jumpsuit"],
  outerwear: ["jacket", "denim-jacket", "leather-jacket", "blazer", "coat", "trench", "puffer", "raincoat"],
  shoes: ["sneakers", "boots", "loafers", "dress-shoes", "heels", "flats", "sandals"],
  bag: ["tote", "crossbody", "backpack", "clutch"],
  accessory: ["hat", "cap", "scarf", "belt", "sunglasses", "jewelry", "watch"],
} as const satisfies Record<Category, readonly string[]>;

export type Subcategory = (typeof SUBCATEGORIES)[Category][number];
export const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flat() as Subcategory[];

export function categoryOf(sub: string): Category | undefined {
  return CATEGORIES.find((c) => (SUBCATEGORIES[c] as readonly string[]).includes(sub));
}

/** Named colour palette. Hex values are used for swatches, illustrations and colour maths. */
export const COLORS = {
  black: "#1c1c1e",
  white: "#f7f7f5",
  cream: "#efe6d2",
  grey: "#9a9a9e",
  beige: "#d9c6a5",
  camel: "#b98a52",
  brown: "#6e4a2f",
  khaki: "#a39c70",
  olive: "#6b6b3a",
  green: "#3f8a4f",
  navy: "#1f2e4d",
  blue: "#2f6fd1",
  "light-blue": "#9cc3ea",
  denim: "#4a6a91",
  purple: "#7a4fa8",
  pink: "#e79bb5",
  red: "#c8312f",
  burgundy: "#6d1f2c",
  orange: "#e5813a",
  yellow: "#e9c53e",
  metallic: "#c9b37e",
} as const;
export type ColorName = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

/** Colours that go with almost everything. */
export const NEUTRALS: ReadonlySet<ColorName> = new Set<ColorName>([
  "black", "white", "cream", "grey", "beige", "camel", "brown", "khaki", "navy", "denim", "metallic",
]);

export const PATTERNS = ["solid", "stripes", "checks", "floral", "graphic", "print", "texture"] as const;
export type Pattern = (typeof PATTERNS)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const STYLES = ["minimal", "classic", "streetwear", "sporty", "boho", "preppy", "edgy", "romantic"] as const;
export type Style = (typeof STYLES)[number];

export const STYLE_INFO: Record<Style, { label: string; blurb: string; emoji: string }> = {
  minimal: { label: "Modern Minimal", blurb: "Clean lines, neutral palette, quality basics.", emoji: "◻️" },
  classic: { label: "Timeless Classic", blurb: "Tailoring, trench coats, polished staples.", emoji: "🧥" },
  streetwear: { label: "Streetwear", blurb: "Oversized fits, sneakers, graphic layers.", emoji: "🧢" },
  sporty: { label: "Sporty & Active", blurb: "Athleisure, comfort and performance fabrics.", emoji: "👟" },
  boho: { label: "Boho Free Spirit", blurb: "Flowing fabrics, earthy tones, prints.", emoji: "🌾" },
  preppy: { label: "Preppy", blurb: "Polos, knits, loafers, crisp colour.", emoji: "🎾" },
  edgy: { label: "Edgy", blurb: "Black, leather, boots, statement attitude.", emoji: "🖤" },
  romantic: { label: "Romantic", blurb: "Soft colours, florals, feminine details.", emoji: "🌸" },
};

export const OCCASIONS = ["casual", "work", "date", "party", "formal", "sport", "travel", "lounge"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_INFO: Record<Occasion, { label: string; emoji: string; formality: [number, number] }> = {
  casual: { label: "Casual", emoji: "☕", formality: [1, 3] },
  work: { label: "Work", emoji: "💼", formality: [3, 4] },
  date: { label: "Date night", emoji: "🍷", formality: [2, 4] },
  party: { label: "Party", emoji: "🎉", formality: [2, 4] },
  formal: { label: "Formal", emoji: "🎩", formality: [4, 5] },
  sport: { label: "Sport", emoji: "🏃", formality: [1, 1] },
  travel: { label: "Travel", emoji: "✈️", formality: [1, 3] },
  lounge: { label: "At home", emoji: "🛋️", formality: [1, 2] },
};

export const FORMALITY_LABELS = ["", "Lounge", "Casual", "Smart casual", "Business", "Formal"];
export const WARMTH_LABELS = ["", "Very light", "Light", "Medium", "Warm", "Very warm"];

/** Outfit slots, in display order. */
export const SLOTS = ["outerwear", "top", "onepiece", "bottom", "shoes", "bag", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];

/** Display label for a subcategory, e.g. "denim-jacket" → "Denim jacket". */
export function subLabel(sub: string): string {
  if (sub === "t-shirt") return "T-shirt";
  const s = sub.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
