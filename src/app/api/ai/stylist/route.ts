import { StylistRequestSchema, StylistSchema } from "@/lib/ai/schemas";
import { AiError, errorResponse, structuredCall } from "@/lib/ai/server";

const SYSTEM = `You are a warm, concise personal stylist inside a wardrobe app.
You receive outfit candidates that were already assembled from the user's real closet and
pre-scored by a rules engine. Choose the best ones for the context and explain each in
plain, encouraging language (mention colours, proportions, weather, and occasion when relevant).
Never invent garments that are not listed in a candidate. Copy candidate ids exactly.`;

export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new AiError("Invalid JSON body", 400);
    }
    const parsed = StylistRequestSchema.safeParse(json);
    if (!parsed.success) throw new AiError("Invalid stylist request", 400);
    const r = parsed.data;

    const prompt = [
      `Occasion: ${r.occasion}`,
      r.weather ? `Weather: ${r.weather}` : "Weather: unknown",
      r.styleSummary ? `User's style profile: ${r.styleSummary}` : "",
      "",
      "Candidates (engine score 0-1 in brackets):",
      ...r.candidates.map((c) => `- id=${c.id} [${c.score.toFixed(2)}]: ${c.pieces.join(" + ")}`),
      "",
      `Pick the ${r.pick} best, most varied outfits, best first.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await structuredCall({ schema: StylistSchema, system: SYSTEM, prompt, effort: "medium", maxTokens: 4000 });
    const valid = new Set(r.candidates.map((c) => c.id));
    const seen = new Set<string>();
    const picks = result.picks.filter((p) => valid.has(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, r.pick);
    return Response.json({ picks });
  } catch (e) {
    return errorResponse(e);
  }
}
