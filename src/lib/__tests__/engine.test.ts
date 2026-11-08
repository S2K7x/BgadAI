import { describe, expect, it } from "vitest";
import { colorHarmony, nearestColorName } from "../colors";
import { matchInspiration, shoppingQuery } from "../matching";
import { generateOutfits, needsOuterwear, scoreOutfit, swapOptions, targetWarmth, type EngineItem } from "../outfitEngine";
import { LOOKS, topStyles, weightsFromSwipes } from "../style";
import type { ItemTags } from "../types";

let n = 0;
function item(tags: Partial<ItemTags> & Pick<ItemTags, "category" | "subcategory">, extra: Partial<EngineItem> = {}): EngineItem {
  n++;
  return {
    id: `i${n}`,
    createdAt: 0,
    status: "active",
    wearCount: 0,
    name: `${tags.subcategory} ${n}`,
    colors: ["black"],
    pattern: "solid",
    formality: 2,
    warmth: 2,
    seasons: [],
    styles: ["minimal"],
    ...tags,
    ...extra,
  };
}

const closet: EngineItem[] = [
  item({ category: "top", subcategory: "t-shirt", colors: ["white"], warmth: 1, styles: ["minimal"] }),
  item({ category: "top", subcategory: "sweater", colors: ["navy"], warmth: 4, styles: ["classic"] }),
  item({ category: "top", subcategory: "shirt", colors: ["light-blue"], formality: 4, styles: ["classic", "preppy"] }),
  item({ category: "top", subcategory: "hoodie", colors: ["red"], warmth: 3, styles: ["streetwear"] }),
  item({ category: "bottom", subcategory: "jeans", colors: ["denim"], warmth: 3, styles: ["classic"] }),
  item({ category: "bottom", subcategory: "trousers", colors: ["black"], formality: 4, warmth: 3, styles: ["minimal", "classic"] }),
  item({ category: "bottom", subcategory: "shorts", colors: ["beige"], warmth: 1, seasons: ["summer"] }),
  item({ category: "bottom", subcategory: "joggers", colors: ["green"], formality: 1, styles: ["sporty"] }),
  item({ category: "shoes", subcategory: "sneakers", colors: ["white"], styles: ["minimal", "streetwear"] }),
  item({ category: "shoes", subcategory: "loafers", colors: ["brown"], formality: 4, styles: ["classic"] }),
  item({ category: "outerwear", subcategory: "coat", colors: ["camel"], formality: 4, warmth: 5, styles: ["classic"] }),
  item({ category: "outerwear", subcategory: "denim-jacket", colors: ["denim"], warmth: 3, styles: ["streetwear"] }),
];

describe("colours", () => {
  it("maps pixels to the nearest palette name", () => {
    expect(nearestColorName([20, 22, 30])).toBe("black");
    expect(nearestColorName([250, 250, 248])).toBe("white");
    expect(nearestColorName([200, 40, 40])).toBe("red");
  });
  it("prefers neutrals + one accent over clashing accents", () => {
    expect(colorHarmony(["navy", "white", "red"]).score).toBeGreaterThan(colorHarmony(["red", "green", "yellow"]).score);
    expect(colorHarmony(["black", "white"]).score).toBeGreaterThan(0.8);
  });
});

describe("weather rules", () => {
  it("targets warmth by temperature", () => {
    expect(targetWarmth(30)).toBe(1);
    expect(targetWarmth(-3)).toBe(5);
    expect(needsOuterwear(10)).toBe(true);
    expect(needsOuterwear(24, 10)).toBe(false);
    expect(needsOuterwear(24, 80)).toBe(true);
  });
});

describe("outfit generation", () => {
  it("builds complete outfits with shoes", () => {
    const { candidates } = generateOutfits(closet, { occasion: "casual", tempC: 20, seed: 1 }, 3);
    expect(candidates.length).toBe(3);
    for (const c of candidates) {
      const cats = c.items.map((i) => i.category);
      expect(cats).toContain("shoes");
      expect(cats.includes("onepiece") || (cats.includes("top") && cats.includes("bottom"))).toBe(true);
      expect(c.explanation.length).toBeGreaterThan(10);
    }
  });

  it("adds outerwear when it is cold and avoids shorts", () => {
    const { candidates } = generateOutfits(closet, { occasion: "casual", tempC: 4, seed: 2 }, 3);
    expect(candidates[0].items.some((i) => i.category === "outerwear")).toBe(true);
    expect(candidates[0].items.some((i) => i.subcategory === "shorts")).toBe(false);
  });

  it("dresses up for work", () => {
    const { candidates } = generateOutfits(closet, { occasion: "work", tempC: 18, seed: 3 }, 1);
    const subs = candidates[0].items.map((i) => i.subcategory);
    expect(subs).not.toContain("joggers");
    expect(subs).not.toContain("hoodie");
  });

  it("respects anchor items", () => {
    const hoodie = closet.find((i) => i.subcategory === "hoodie")!;
    const { candidates } = generateOutfits(closet, { occasion: "casual", tempC: 15, anchorIds: [hoodie.id], seed: 4 }, 2);
    for (const c of candidates) expect(c.items.map((i) => i.id)).toContain(hoodie.id);
  });

  it("reports missing slots on an empty closet", () => {
    const { candidates, missing } = generateOutfits([], { occasion: "casual" });
    expect(candidates).toHaveLength(0);
    expect(missing).toEqual(expect.arrayContaining(["shoes", "top", "bottom"]));
  });

  it("produces diverse suggestions", () => {
    const { candidates } = generateOutfits(closet, { occasion: "casual", tempC: 18, seed: 5 }, 3);
    const keys = candidates.map((c) => c.items.map((i) => i.id).sort().join());
    expect(new Set(keys).size).toBe(3);
  });

  it("learns from negative feedback", () => {
    const tee = closet[0], jeans = closet[4], sneakers = closet[8];
    const ctx = { occasion: "casual" as const, tempC: 20 };
    const base = scoreOutfit([tee, jeans, sneakers], ctx).total;
    const disliked = scoreOutfit([tee, jeans, sneakers], {
      ...ctx,
      feedback: [{ id: "f", createdAt: 0, itemIds: [tee.id, jeans.id, sneakers.id], rating: -1 }],
    }).total;
    expect(disliked).toBeLessThan(base);
  });

  it("ranks swap options for a piece", () => {
    const outfit = [closet[0], closet[4], closet[8]];
    const opts = swapOptions(outfit, closet[0].id, closet, { occasion: "casual", tempC: 20 });
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.item.category === "top")).toBe(true);
  });
});

describe("inspiration matching", () => {
  it("finds owned pieces and flags missing ones", () => {
    const matches = matchInspiration(
      [
        { category: "outerwear", subcategory: "coat", colors: ["camel"], pattern: "solid", formality: 4, styles: ["classic"], description: "camel wool coat" },
        { category: "shoes", subcategory: "boots", colors: ["burgundy"], pattern: "solid", formality: 3, styles: ["edgy"], description: "burgundy chelsea boots" },
      ],
      closet,
    );
    expect(matches[0].owned).toBe(true);
    expect(matches[0].best?.item.subcategory).toBe("coat");
    expect(matches[1].owned).toBe(false);
  });
  it("builds a shopping query", () => {
    expect(
      shoppingQuery({ colors: ["camel"], subcategory: "coat", pattern: "solid", description: "" }, "womenswear"),
    ).toBe("camel coat women");
  });
});

describe("style profile", () => {
  it("turns swipes into normalised weights", () => {
    const street = LOOKS.filter((l) => l.styles.streetwear === 1);
    const boho = LOOKS.find((l) => l.styles.boho === 1)!;
    const w = weightsFromSwipes([...street.map((look) => ({ look, value: 1 })), { look: boho, value: -0.6 }]);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(topStyles(w)[0].style).toBe("streetwear");
    expect(w.boho).toBe(0);
  });
});

describe("sample photos", () => {
  it("finds the closest real photo for a type and colour", async () => {
    const { findSample, sampleCloset, SAMPLES } = await import("../samples");
    expect(SAMPLES.length).toBeGreaterThan(30);
    expect(findSample("t-shirt", "white")?.key).toBe("tee-white");
    expect(findSample("trousers", "navy")?.subcategory).toBe("trousers");
    expect(findSample("hat", "beige")?.category).toBe("accessory"); // no hat photo → nearest accessory
    const women = sampleCloset("womenswear");
    expect(women.every((s) => s.gender !== "m")).toBe(true);
    expect(new Set(women.map((s) => s.category))).toEqual(expect.objectContaining({ size: expect.any(Number) }));
  });
});
