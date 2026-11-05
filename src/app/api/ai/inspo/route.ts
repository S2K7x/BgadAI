import { InspoSchema } from "@/lib/ai/schemas";
import { errorResponse, readImageBody, structuredCall } from "@/lib/ai/server";
import { SUBCATEGORIES } from "@/lib/taxonomy";

const SYSTEM = `You are a personal stylist analysing outfit inspiration photos (street style, Pinterest, Instagram).
Break the look down into its individual garments using ONLY the allowed enum values.
Subcategories per category: ${Object.entries(SUBCATEGORIES)
  .map(([c, subs]) => `${c}: ${subs.join(", ")}`)
  .join("; ")}.
Describe only clothing, shoes, bags and accessories — never comment on the person's body or identity.
If several people appear, describe the most prominent outfit.`;

export async function POST(req: Request) {
  try {
    const { image } = await readImageBody(req);
    const result = await structuredCall({
      schema: InspoSchema,
      system: SYSTEM,
      prompt:
        "List every visible garment, shoe, bag and key accessory in this look, most important first (max 7). For each, give a specific shopping-style description (fit, fabric, details).",
      image,
      effort: "low",
    });
    const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
    const garments = result.garments.slice(0, 7).map((g) => ({
      ...g,
      subcategory: (SUBCATEGORIES[g.category] as readonly string[]).includes(g.subcategory)
        ? g.subcategory
        : SUBCATEGORIES[g.category][0],
      colors: [...new Set(g.colors)].slice(0, 3),
      formality: clamp(g.formality),
    }));
    return Response.json({ summary: result.summary, garments });
  } catch (e) {
    return errorResponse(e);
  }
}
