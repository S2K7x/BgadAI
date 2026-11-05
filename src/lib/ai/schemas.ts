import { z } from "zod";
import {
  ALL_SUBCATEGORIES,
  CATEGORIES,
  COLOR_NAMES,
  OCCASIONS,
  PATTERNS,
  SEASONS,
  STYLES,
} from "../taxonomy";

const category = z.enum(CATEGORIES);
const subcategory = z.enum(ALL_SUBCATEGORIES as [string, ...string[]]);
const color = z.enum(COLOR_NAMES as [string, ...string[]]);

export const GarmentTagsSchema = z.object({
  name: z.string().describe("Short human name, e.g. 'Navy wool overshirt'"),
  category,
  subcategory,
  colors: z.array(color).describe("1-3 colours, dominant first"),
  pattern: z.enum(PATTERNS),
  formality: z.number().int().describe("1 lounge, 2 casual, 3 smart casual, 4 business, 5 formal"),
  warmth: z.number().int().describe("1 very light (tank) … 5 very warm (puffer)"),
  seasons: z.array(z.enum(SEASONS)),
  styles: z.array(z.enum(STYLES)).describe("1-3 style archetypes the piece expresses"),
});

export const AnalyzeSchema = z.object({
  items: z.array(
    GarmentTagsSchema.extend({
      box: z
        .object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() })
        .describe("Normalised bounding box (0-1) of this garment in the photo"),
    }),
  ),
});
export type AnalyzeResult = z.infer<typeof AnalyzeSchema>;

export const InspoSchema = z.object({
  summary: z.string().describe("One sentence describing the look's vibe"),
  garments: z.array(
    z.object({
      category,
      subcategory,
      colors: z.array(color),
      pattern: z.enum(PATTERNS),
      formality: z.number().int(),
      styles: z.array(z.enum(STYLES)),
      description: z.string().describe("Short shopping-style description, e.g. 'cropped boxy camel wool jacket'"),
    }),
  ),
});
export type InspoResult = z.infer<typeof InspoSchema>;

export const StylistRequestSchema = z.object({
  occasion: z.enum(OCCASIONS),
  weather: z.string().optional(),
  styleSummary: z.string().optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        pieces: z.array(z.string()).max(8),
        score: z.number(),
      }),
    )
    .min(1)
    .max(12),
  pick: z.number().int().min(1).max(5),
});
export type StylistRequest = z.infer<typeof StylistRequestSchema>;

export const StylistSchema = z.object({
  picks: z.array(
    z.object({
      id: z.string().describe("Candidate id, copied exactly"),
      title: z.string().describe("Catchy 2-4 word outfit name"),
      explanation: z.string().describe("One or two friendly sentences on why it works today"),
    }),
  ),
});
export type StylistResult = z.infer<typeof StylistSchema>;
