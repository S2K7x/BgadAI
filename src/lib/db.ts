/**
 * Local-first storage in IndexedDB (via Dexie). Photos never leave the device
 * except when the user explicitly runs AI analysis on them.
 */
import Dexie, { type EntityTable } from "dexie";
import type { DayPlan, Feedback, Inspiration, Item, Outfit, StyleProfile, Trip, WearLog, WishItem } from "./types";
import { emptyWeights } from "./style";

type ProfileRow = StyleProfile & { id: "me" };

class BgadDB extends Dexie {
  items!: EntityTable<Item, "id">;
  outfits!: EntityTable<Outfit, "id">;
  wearLogs!: EntityTable<WearLog, "id">;
  feedback!: EntityTable<Feedback, "id">;
  inspirations!: EntityTable<Inspiration, "id">;
  profile!: EntityTable<ProfileRow, "id">;
  plans!: EntityTable<DayPlan, "id">;
  trips!: EntityTable<Trip, "id">;
  wishlist!: EntityTable<WishItem, "id">;

  constructor() {
    super("bgadai");
    this.version(1).stores({
      items: "id, createdAt, category, status, wearCount",
      outfits: "id, createdAt, source, favorite",
      wearLogs: "id, date",
      feedback: "id, createdAt",
      inspirations: "id, createdAt",
      profile: "id",
    });
    this.version(2).stores({
      plans: "id",
      trips: "id, createdAt",
      wishlist: "id, createdAt",
    });
  }
}

export const db = new BgadDB();

export const DEFAULT_PROFILE: StyleProfile = {
  completedOnboarding: false,
  wardrobe: "both",
  lifestyle: ["casual"],
  budget: "mid",
  styleWeights: emptyWeights(),
  favoriteColors: [],
  avoidColors: [],
  backgroundRemoval: false,
};

export async function getProfile(): Promise<StyleProfile> {
  const row = await db.profile.get("me");
  return row ? { ...DEFAULT_PROFILE, ...row } : DEFAULT_PROFILE;
}

export async function saveProfile(patch: Partial<StyleProfile>) {
  const current = await getProfile();
  await db.profile.put({ ...current, ...patch, id: "me" });
}

export function uid() {
  return crypto.randomUUID();
}

export function today(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Log an outfit as worn today: increments wear counts and records history. */
export async function logWorn(itemIds: string[], outfitId?: string) {
  const now = Date.now();
  await db.transaction("rw", db.items, db.wearLogs, async () => {
    await db.wearLogs.add({ id: uid(), date: today(), itemIds, outfitId });
    for (const id of itemIds) {
      const it = await db.items.get(id);
      if (it) await db.items.update(id, { wearCount: it.wearCount + 1, lastWornAt: now });
    }
  });
}

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob();
}

/** Full JSON backup including photos (data URLs). */
export async function exportAll(): Promise<Blob> {
  const items = await Promise.all(
    (await db.items.toArray()).map(async (i) => ({ ...i, image: await blobToDataUrl(i.image), thumb: await blobToDataUrl(i.thumb) })),
  );
  const inspirations = await Promise.all(
    (await db.inspirations.toArray()).map(async (i) => ({ ...i, image: await blobToDataUrl(i.image) })),
  );
  const payload = {
    app: "bgadai",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: await db.profile.get("me"),
    items,
    outfits: await db.outfits.toArray(),
    wearLogs: await db.wearLogs.toArray(),
    feedback: await db.feedback.toArray(),
    inspirations,
  };
  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export async function importAll(file: File) {
  const data = JSON.parse(await file.text());
  if (data.app !== "bgadai") throw new Error("Not a BgadAI backup file");
  const items: Item[] = await Promise.all(
    data.items.map(async (i: Item & { image: string; thumb: string }) => ({
      ...i,
      image: await dataUrlToBlob(i.image),
      thumb: await dataUrlToBlob(i.thumb),
    })),
  );
  const inspirations: Inspiration[] = await Promise.all(
    (data.inspirations ?? []).map(async (i: Inspiration & { image: string }) => ({ ...i, image: await dataUrlToBlob(i.image) })),
  );
  await db.transaction("rw", [db.items, db.outfits, db.wearLogs, db.feedback, db.inspirations, db.profile], async () => {
    if (data.profile) await db.profile.put(data.profile);
    await db.items.bulkPut(items);
    await db.outfits.bulkPut(data.outfits ?? []);
    await db.wearLogs.bulkPut(data.wearLogs ?? []);
    await db.feedback.bulkPut(data.feedback ?? []);
    await db.inspirations.bulkPut(inspirations);
  });
}

export async function wipeAll() {
  await Promise.all(
    [db.items, db.outfits, db.wearLogs, db.feedback, db.inspirations, db.profile, db.plans, db.trips, db.wishlist].map((t) => t.clear()),
  );
}

/** Add the bundled real-photo sample closet (skips pieces already added). Returns how many were added. */
export async function loadSampleCloset(wardrobe: "womenswear" | "menswear" | "both"): Promise<number> {
  const { sampleCloset } = await import("./samples");
  const have = new Set((await db.items.toArray()).map((i) => i.sample).filter(Boolean));
  const picks = sampleCloset(wardrobe).filter((s) => !have.has(s.key));
  const now = Date.now();
  const items: Item[] = await Promise.all(
    picks.map(async (s, i) => {
      const blob = await (await fetch(s.src)).blob();
      return {
        id: uid(),
        createdAt: now - i, // keep catalogue order (tops first) in the newest-first closet
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        colors: s.colors,
        pattern: s.pattern,
        formality: s.formality,
        warmth: s.warmth,
        seasons: s.seasons,
        styles: s.styles,
        image: blob,
        thumb: blob, // already a small 600x800 webp
        status: "active" as const,
        wearCount: 0,
        sample: s.key,
      };
    }),
  );
  await db.items.bulkAdd(items);
  return items.length;
}

/** Remove every sample piece (and keeps the user's own clothes). */
export async function removeSampleCloset() {
  const ids = (await db.items.toArray()).filter((i) => i.sample).map((i) => i.id);
  await db.items.bulkDelete(ids);
  return ids.length;
}
