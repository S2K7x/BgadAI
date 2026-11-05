/**
 * Hybrid outfit generator: retrieve → constrain → score → diversify → explain.
 *
 * Everything here is deterministic, cheap and runs on-device. An LLM is only used
 * (optionally) afterwards to re-rank the top candidates and write explanations,
 * so we never send the whole closet to a model or let it invent items.
 */
import { colorHarmony } from "./colors";
import { OCCASION_INFO, type Occasion, type Season, type Slot, type Style } from "./taxonomy";
import type { Feedback, Item, OutfitPiece } from "./types";

export type EngineItem = Omit<Item, "image" | "thumb">;

export type EngineContext = {
  occasion: Occasion;
  /** Feels-like temperature in °C; undefined = unknown weather */
  tempC?: number;
  precipProb?: number;
  styleWeights?: Partial<Record<Style, number>>;
  avoidColors?: string[];
  feedback?: Feedback[];
  now?: number;
  /** Item ids that must appear in every outfit (e.g. "style this piece"). */
  anchorIds?: string[];
  seed?: number;
};

export type ScoreBreakdown = {
  color: number;
  formality: number;
  weather: number;
  style: number;
  freshness: number;
  feedback: number;
  total: number;
  notes: string[];
};

export type Candidate = {
  pieces: OutfitPiece[];
  items: EngineItem[];
  score: ScoreBreakdown;
  explanation: string;
};

const WEIGHTS = { color: 0.26, formality: 0.2, weather: 0.22, style: 0.16, freshness: 0.08, feedback: 0.08 };
const DAY = 86_400_000;

export function targetWarmth(tempC: number): number {
  if (tempC >= 26) return 1;
  if (tempC >= 20) return 2;
  if (tempC >= 13) return 3;
  if (tempC >= 6) return 4;
  return 5;
}

export function seasonFor(tempC: number): Season {
  if (tempC >= 22) return "summer";
  if (tempC >= 14) return "spring";
  if (tempC >= 7) return "autumn";
  return "winter";
}

export function needsOuterwear(tempC?: number, precipProb?: number): boolean {
  if (tempC === undefined) return false;
  return tempC < 16 || (precipProb ?? 0) >= 50;
}

/** Small seeded PRNG so suggestions are reproducible within a day. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formalityFit(item: EngineItem, occasion: Occasion): number {
  const [lo, hi] = OCCASION_INFO[occasion].formality;
  if (item.formality >= lo && item.formality <= hi) return 1;
  const gap = item.formality < lo ? lo - item.formality : item.formality - hi;
  return Math.max(0, 1 - gap * 0.45);
}

function slotFor(item: EngineItem): Slot {
  return item.category;
}

/** Score a full set of items as an outfit. Also used by the manual builder for live feedback. */
export function scoreOutfit(items: EngineItem[], ctx: EngineContext): ScoreBreakdown {
  const notes: string[] = [];
  const clothing = items.filter((i) => i.category !== "accessory" && i.category !== "bag");

  // Colour — only count the dominant colour of each garment, plus secondary of the first patterned one.
  const colorList = items.flatMap((i) => i.colors.slice(0, i.pattern === "solid" ? 1 : 2));
  const harmony = colorHarmony(colorList);
  let color = harmony.score;
  const patterned = clothing.filter((i) => i.pattern !== "solid" && i.pattern !== "texture");
  if (patterned.length > 1) {
    color -= 0.25 * (patterned.length - 1);
    notes.push("Two patterns compete — keep one statement piece");
  }
  if (ctx.avoidColors?.length && items.some((i) => i.colors.some((c) => ctx.avoidColors!.includes(c)))) {
    color -= 0.3;
  }
  color = clamp(color);
  notes.unshift(harmony.note);

  // Formality — fit to the occasion and coherence across pieces.
  const fits = clothing.map((i) => formalityFit(i, ctx.occasion));
  const fForm = clothing.map((i) => i.formality);
  const spread = fForm.length ? Math.max(...fForm) - Math.min(...fForm) : 0;
  const formality = clamp(avg(fits) - Math.max(0, spread - 1) * 0.2);
  if (spread >= 3) notes.push("Mixes very dressy and very casual pieces");

  // Weather — layered warmth vs. target, season tags, rain.
  let weather = 0.8;
  if (ctx.tempC !== undefined) {
    const target = targetWarmth(ctx.tempC);
    const core = clothing.filter((i) => i.category !== "outerwear" && i.category !== "shoes");
    const outer = clothing.find((i) => i.category === "outerwear");
    const coreWarmth = core.length ? Math.max(...core.map((i) => i.warmth)) : 3;
    const layered = outer ? Math.max(coreWarmth, outer.warmth) + (target >= 4 ? 0.5 : 0) : coreWarmth;
    const diff = layered - target;
    weather = clamp(1 - Math.abs(diff) * 0.28 - (diff > 0 && target <= 2 ? 0.15 : 0));
    const season = seasonFor(ctx.tempC);
    const offSeason = clothing.filter((i) => i.seasons.length && !i.seasons.includes(season)).length;
    weather = clamp(weather - offSeason * 0.08);
    if (needsOuterwear(ctx.tempC, ctx.precipProb) && !outer && !core.some((i) => i.warmth >= 4)) {
      weather = clamp(weather - 0.3);
      notes.push("You might want a layer today");
    }
    if ((ctx.precipProb ?? 0) >= 50) {
      const shoes = items.find((i) => i.category === "shoes");
      if (shoes && (shoes.subcategory === "sandals" || shoes.subcategory === "heels")) weather = clamp(weather - 0.2);
    }
  }

  // Style — how well the pieces express the user's style profile.
  let style = 0.6;
  const sw = ctx.styleWeights;
  if (sw && Object.keys(sw).length) {
    const maxW = Math.max(...Object.values(sw).map((v) => v ?? 0), 0.0001);
    const per = clothing.map((i) =>
      i.styles.length ? Math.max(...i.styles.map((s) => (sw[s] ?? 0) / maxW)) : 0.5,
    );
    style = clamp(0.25 + 0.75 * avg(per));
  }

  // Freshness — rotate under-worn items, avoid repeats from the last few days.
  const now = ctx.now ?? Date.now();
  const fresh = clothing.map((i) => {
    if (i.lastWornAt && now - i.lastWornAt < 2 * DAY) return 0.1;
    if (i.lastWornAt && now - i.lastWornAt < 5 * DAY) return 0.6;
    return i.wearCount === 0 ? 1 : 0.85;
  });
  const freshness = clamp(avg(fresh));

  // Feedback — learned pairwise likes/dislikes.
  let fb = 0.5;
  if (ctx.feedback?.length) {
    const ids = new Set(items.map((i) => i.id));
    let sum = 0;
    for (const f of ctx.feedback) {
      const overlap = f.itemIds.filter((id) => ids.has(id)).length;
      if (overlap >= 2) sum += f.rating * (overlap / Math.max(f.itemIds.length, 1));
    }
    fb = clamp(0.5 + sum * 0.25);
  }

  const total =
    color * WEIGHTS.color +
    formality * WEIGHTS.formality +
    weather * WEIGHTS.weather +
    style * WEIGHTS.style +
    freshness * WEIGHTS.freshness +
    fb * WEIGHTS.feedback;

  return { color, formality, weather, style, freshness, feedback: fb, total, notes };
}

/** Human-readable reasoning for an outfit, built from the score components. */
export function explain(items: EngineItem[], score: ScoreBreakdown, ctx: EngineContext): string {
  const parts: string[] = [];
  parts.push(score.notes[0]);
  const outer = items.find((i) => i.category === "outerwear");
  if (ctx.tempC !== undefined) {
    if (outer) parts.push(`the ${outer.name.toLowerCase()} covers ${Math.round(ctx.tempC)}°C`);
    else if (ctx.tempC >= 22) parts.push(`light pieces for ${Math.round(ctx.tempC)}°C`);
  }
  const occ = OCCASION_INFO[ctx.occasion].label.toLowerCase();
  if (score.formality >= 0.85) parts.push(`right level of polish for ${occ}`);
  if (score.style >= 0.85) parts.push("very on-brand for your style");
  const neverWorn = items.find((i) => i.wearCount === 0 && i.category !== "accessory");
  if (neverWorn) parts.push(`gives your ${neverWorn.name.toLowerCase()} its first outing`);
  const text = parts.filter(Boolean).join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

type Pool = Record<Slot, EngineItem[]>;

function buildPool(items: EngineItem[], ctx: EngineContext): Pool {
  const pool: Pool = { top: [], bottom: [], onepiece: [], outerwear: [], shoes: [], bag: [], accessory: [] };
  for (const it of items) {
    if (it.status !== "active") continue;
    // Hard constraints: drop pieces that are way off the occasion's formality.
    if (it.category !== "accessory" && it.category !== "bag" && formalityFit(it, ctx.occasion) < 0.3) continue;
    // Drop very warm pieces in heat and very light pieces in deep cold (except shoes/accessories).
    if (ctx.tempC !== undefined && ["top", "bottom", "onepiece", "outerwear"].includes(it.category)) {
      const t = targetWarmth(ctx.tempC);
      if (t <= 1 && it.warmth >= 4) continue;
      if (t >= 5 && it.warmth <= 1 && it.category !== "top") continue;
    }
    pool[slotFor(it)].push(it);
  }
  return pool;
}

function sample<T>(arr: T[], n: number, rnd: () => number): T[] {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function bestAddition(base: EngineItem[], options: EngineItem[], ctx: EngineContext): EngineItem | undefined {
  let best: EngineItem | undefined;
  let bestScore = -Infinity;
  for (const o of options) {
    const s = scoreOutfit([...base, o], ctx).total;
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}

export type GenerateResult = { candidates: Candidate[]; missing: Slot[] };

/** Generate up to `count` diverse, high-scoring outfits from the closet. */
export function generateOutfits(allItems: EngineItem[], ctx: EngineContext, count = 3): GenerateResult {
  const rnd = mulberry32(ctx.seed ?? Math.floor((ctx.now ?? Date.now()) / DAY));
  const pool = buildPool(allItems, ctx);
  const anchors = (ctx.anchorIds ?? [])
    .map((id) => allItems.find((i) => i.id === id))
    .filter((i): i is EngineItem => !!i);

  const missing: Slot[] = [];
  if (!pool.shoes.length) missing.push("shoes");
  if (!pool.onepiece.length && (!pool.top.length || !pool.bottom.length)) {
    if (!pool.top.length) missing.push("top");
    if (!pool.bottom.length) missing.push("bottom");
  }

  // 1. Bases: top+bottom pairs and one-pieces (sampled to keep it fast on big closets).
  const bases: EngineItem[][] = [];
  for (const t of sample(pool.top, 25, rnd)) for (const b of sample(pool.bottom, 20, rnd)) bases.push([t, b]);
  for (const d of pool.onepiece) bases.push([d]);

  const anchored = bases
    .map((b) => {
      const set = [...b];
      for (const a of anchors) {
        if (set.some((s) => s.id === a.id)) continue;
        // Anchor replaces whatever occupies its slot.
        const conflict = (s: EngineItem) =>
          s.category === a.category ||
          (a.category === "onepiece" && (s.category === "top" || s.category === "bottom")) ||
          (s.category === "onepiece" && (a.category === "top" || a.category === "bottom"));
        const filtered = set.filter((s) => !conflict(s));
        filtered.push(a);
        set.splice(0, set.length, ...filtered);
      }
      return set;
    })
    .filter((set) => {
      const hasCore = set.some((i) => i.category === "onepiece") ||
        (set.some((i) => i.category === "top") && set.some((i) => i.category === "bottom"));
      return hasCore;
    });

  // Dedupe bases after anchoring.
  const seen = new Set<string>();
  const uniqueBases = anchored.filter((s) => {
    const k = s.map((i) => i.id).sort().join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 2. Complete each base greedily with shoes, outerwear (if needed or helpful) and a bag.
  const wantOuter = needsOuterwear(ctx.tempC, ctx.precipProb);
  const scored: Candidate[] = [];
  const prelim = uniqueBases
    .map((b) => ({ b, s: scoreOutfit(b, ctx).total }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 80);

  for (const { b } of prelim) {
    const set = [...b];
    if (!set.some((i) => i.category === "shoes")) {
      const shoes = bestAddition(set, pool.shoes, ctx);
      if (shoes) set.push(shoes);
    }
    if (!set.some((i) => i.category === "outerwear") && pool.outerwear.length) {
      const outer = bestAddition(set, pool.outerwear, ctx);
      if (outer && (wantOuter || scoreOutfit([...set, outer], ctx).total > scoreOutfit(set, ctx).total + 0.01)) {
        set.push(outer);
      }
    }
    if (!set.some((i) => i.category === "bag") && pool.bag.length && ctx.occasion !== "sport" && ctx.occasion !== "lounge") {
      const bag = bestAddition(set, pool.bag, ctx);
      if (bag && scoreOutfit([...set, bag], ctx).total >= scoreOutfit(set, ctx).total - 0.01) set.push(bag);
    }
    const score = scoreOutfit(set, ctx);
    scored.push({
      items: set,
      pieces: set.map((i) => ({ slot: slotFor(i), itemId: i.id })),
      score,
      explanation: explain(set, score, ctx),
    });
  }

  scored.sort((a, b) => b.score.total - a.score.total);

  // 3. Diversify (maximal marginal relevance): penalise reusing the same garments.
  const picked: Candidate[] = [];
  const usage = new Map<string, number>();
  while (picked.length < count && scored.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    scored.forEach((c, idx) => {
      const reuse = c.items.reduce(
        (acc, i) => acc + (anchors.some((a) => a.id === i.id) ? 0 : (usage.get(i.id) ?? 0)),
        0,
      );
      const val = c.score.total - reuse * 0.08;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = idx;
      }
    });
    const [c] = scored.splice(bestIdx, 1);
    picked.push(c);
    c.items.forEach((i) => usage.set(i.id, (usage.get(i.id) ?? 0) + 1));
  }

  return { candidates: picked, missing };
}

/** Alternatives for one piece of an outfit ("swap this"), best first. */
export function swapOptions(outfit: EngineItem[], replaceId: string, allItems: EngineItem[], ctx: EngineContext, n = 8) {
  const target = outfit.find((i) => i.id === replaceId);
  if (!target) return [];
  const rest = outfit.filter((i) => i.id !== replaceId);
  return allItems
    .filter((i) => i.status === "active" && i.category === target.category && i.id !== replaceId)
    .map((i) => ({ item: i, score: scoreOutfit([...rest, i], ctx).total }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
}
function clamp(x: number) {
  return Math.max(0, Math.min(1, x));
}
