import { AnalyzeSchema } from "@/lib/ai/schemas";
import { errorResponse, readImageBody, structuredCall } from "@/lib/ai/server";
import { SUBCATEGORIES } from "@/lib/taxonomy";

const SYSTEM = `You are a meticulous fashion cataloguer for a digital wardrobe app.
You look at photos of clothing and return structured tags using ONLY the allowed enum values.
Subcategories per category: ${Object.entries(SUBCATEGORIES)
  .map(([c, subs]) => `${c}: ${subs.join(", ")}`)
  .join("; ")}.
Pick the subcategory that belongs to the chosen category. Colours: name the garment's actual
fabric colours (ignore the background, hangers, skin, and props), dominant first. "denim" is for
classic mid-blue denim; use "light-blue"/"navy"/"black" for other washes. Use "texture" pattern for
knits/ribbing/quilting that read as solid. Seasons: every season the piece is comfortable in.`;

export async function POST(req: Request) {
  try {
    const { image, body } = await readImageBody(req);
    const multi = body.multi === true;
    const prompt = multi
      ? "This photo may show several garments laid out together (a flat lay or a pile). Return one entry per distinct garment, shoe pair, bag or accessory, each with a tight bounding box. Ignore people's faces and non-clothing objects."
      : "This photo shows one garment (possibly worn or on a hanger). Return exactly one item describing the main garment, with its bounding box.";
    const result = await structuredCall({ schema: AnalyzeSchema, system: SYSTEM, prompt, image, effort: "low" });

    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
    const items = result.items.slice(0, multi ? 12 : 1).map((it) => ({
      ...it,
      subcategory: (SUBCATEGORIES[it.category] as readonly string[]).includes(it.subcategory)
        ? it.subcategory
        : SUBCATEGORIES[it.category][0],
      colors: [...new Set(it.colors)].slice(0, 3),
      formality: clamp(it.formality, 1, 5),
      warmth: clamp(it.warmth, 1, 5),
      styles: [...new Set(it.styles)].slice(0, 3),
      box: {
        x0: Math.max(0, Math.min(1, it.box.x0)),
        y0: Math.max(0, Math.min(1, it.box.y0)),
        x1: Math.max(0, Math.min(1, it.box.x1)),
        y1: Math.max(0, Math.min(1, it.box.y1)),
      },
    }));
    return Response.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
