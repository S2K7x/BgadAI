import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Server-side Claude access. The API key never reaches the browser.
 * Model is configurable; set BGADAI_MODEL to e.g. a Haiku model to cut tagging costs.
 */
export const MODEL = process.env.BGADAI_MODEL || "claude-opus-5-5";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

/** One structured-output call: optional image + instructions → validated object. */
export async function structuredCall<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  image?: ImageInput;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (!aiEnabled()) throw new AiError("AI is not configured (set ANTHROPIC_API_KEY)", 503);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (opts.image) {
    content.push({ type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.base64 } });
  }
  content.push({ type: "text", text: opts.prompt });

  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: [{ role: "user", content }],
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      // Re-run on Anthropic's recommended fallback model if a safety classifier declines.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") {
      throw new AiError("The AI declined to analyse this image. Try another photo.", 422);
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new AiError("The AI response was incomplete. Please try again.", 502);
    }
    return response.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AiError("AI is busy — try again in a moment.", 429);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("AI key is invalid.", 503);
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`AI request rejected: ${e.message}`, 400);
    if (e instanceof Anthropic.APIError) throw new AiError(`AI service error (${e.status ?? "?"})`, 502);
    throw new AiError("Could not reach the AI service.", 502);
  }
}

const MAX_IMAGE_B64 = 5_000_000;

export async function readImageBody(req: Request): Promise<{ image: ImageInput; body: Record<string, unknown> }> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new AiError("Invalid JSON body", 400);
  }
  const b64 = body.image;
  if (typeof b64 !== "string" || !b64.length) throw new AiError("Missing image", 400);
  if (b64.length > MAX_IMAGE_B64) throw new AiError("Image too large", 413);
  const mt = body.mediaType;
  const mediaType = mt === "image/png" || mt === "image/webp" ? mt : "image/jpeg";
  return { image: { base64: b64, mediaType }, body };
}

export function errorResponse(e: unknown) {
  const err = e instanceof AiError ? e : new AiError("Unexpected error");
  if (!(e instanceof AiError)) console.error(e);
  return Response.json({ error: err.message }, { status: err.status });
}
