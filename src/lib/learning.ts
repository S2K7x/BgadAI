/**
 * Taste learning: every 👍 / 👎 / "wore it" nudges the style profile toward (or away from)
 * the styles of those pieces, so suggestions drift toward what you actually like and wear.
 */
import { normalise } from "./style";
import { STYLES, type Style } from "./taxonomy";

export const SIGNAL = { like: 1, dislike: -0.6, wear: 0.5 } as const;
const RATE = 0.05;

export function nudgeStyles(
  weights: Record<Style, number>,
  pieces: { styles: Style[] }[],
  signal: number,
): Record<Style, number> {
  const next = { ...weights };
  const counts = new Map<Style, number>();
  for (const p of pieces) for (const s of p.styles) counts.set(s, (counts.get(s) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  for (const s of STYLES) {
    const share = (counts.get(s) ?? 0) / total;
    // A floor keeps a style you already had from vanishing after a few dislikes.
    const prev = next[s] ?? 0;
    next[s] = Math.max(prev > 0 ? 0.01 : 0, prev + RATE * signal * share);
  }
  return normalise(next);
}
