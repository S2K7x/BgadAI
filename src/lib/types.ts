import type { Category, ColorName, Occasion, Pattern, Season, Slot, Style, Subcategory } from "./taxonomy";

export type ItemTags = {
  category: Category;
  subcategory: Subcategory;
  colors: ColorName[];
  pattern: Pattern;
  /** 1 (lounge) … 5 (formal) */
  formality: number;
  /** 1 (very light) … 5 (very warm) */
  warmth: number;
  seasons: Season[];
  styles: Style[];
  name: string;
};

export type Item = ItemTags & {
  id: string;
  createdAt: number;
  image: Blob;
  thumb: Blob;
  brand?: string;
  price?: number;
  /** "active" items are used for outfits; "laundry" is temporarily excluded */
  status: "active" | "laundry" | "archived";
  wearCount: number;
  lastWornAt?: number;
  /** When the item went into the laundry (auto-returns after the profile's laundryDays). */
  laundryAt?: number;
  /** Set for pieces loaded from the bundled sample closet. */
  sample?: string;
};

export type OutfitPiece = { slot: Slot; itemId: string };

export type Outfit = {
  id: string;
  createdAt: number;
  name: string;
  source: "ai" | "manual" | "inspo";
  occasion?: Occasion;
  pieces: OutfitPiece[];
  explanation?: string;
  favorite?: boolean;
};

export type WearLog = {
  id: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitId?: string;
};

/** Pairwise feedback learned from 👍/👎 on suggestions. */
export type Feedback = {
  id: string;
  createdAt: number;
  itemIds: string[];
  rating: 1 | -1;
};

export type StyleProfile = {
  completedOnboarding: boolean;
  wardrobe: "womenswear" | "menswear" | "both";
  lifestyle: Occasion[];
  budget: "low" | "mid" | "high";
  city?: { name: string; latitude: number; longitude: number; country?: string };
  /** Archetype weights, normalised to sum to 1. */
  styleWeights: Record<Style, number>;
  favoriteColors: ColorName[];
  avoidColors: ColorName[];
  backgroundRemoval: boolean;
  /** Days after which laundry returns to the closet automatically (0 = never). */
  laundryDays: number;
};

export type DetectedGarment = {
  category: Category;
  subcategory: Subcategory;
  colors: ColorName[];
  pattern: Pattern;
  formality: number;
  styles: Style[];
  description: string;
};

export type Inspiration = {
  id: string;
  createdAt: number;
  image: Blob;
  garments: DetectedGarment[];
};

export type Weather = {
  tempC: number;
  feelsLikeC: number;
  tempMaxC: number;
  tempMinC: number;
  precipProb: number;
  code: number;
  summary: string;
  emoji: string;
};

/** An outfit planned for a calendar day (id = YYYY-MM-DD). */
export type DayPlan = {
  id: string;
  itemIds: string[];
  occasion?: import("./taxonomy").Occasion;
  outfitId?: string;
};

export type Trip = {
  id: string;
  createdAt: number;
  city: { name: string; latitude: number; longitude: number; country?: string };
  start: string; // YYYY-MM-DD
  nights: number;
  days: { date: string; occasion: import("./taxonomy").Occasion; tempC?: number; precipProb?: number; itemIds: string[] }[];
  packing: string[];
  packed: string[];
};

/** A piece you're thinking of buying, checked against your closet. */
export type WishItem = ItemTags & {
  id: string;
  createdAt: number;
  thumb?: Blob;
  src?: string;
  unlocks: number;
};
