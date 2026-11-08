"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { toEngine, useAiStatus, useItems, useProfile } from "@/hooks/data";
import type { AnalyzeResult } from "@/lib/ai/schemas";
import { db, uid } from "@/lib/db";
import { blobToBase64, extractColors, resizeImage } from "@/lib/image";
import { garmentSimilarity, shoppingLinks, shoppingQuery } from "@/lib/matching";
import { outfitsUnlocked, type EngineItem } from "@/lib/outfitEngine";
import { SAMPLES, type SamplePiece } from "@/lib/samples";
import { CATEGORIES, CATEGORY_LABELS, SUBCATEGORIES, subLabel, type Category, type ColorName, type Subcategory } from "@/lib/taxonomy";
import type { Item, ItemTags } from "@/lib/types";
import { ItemImage } from "./ItemImage";
import { Button, Card, Chip, ColorPicker, SectionTitle, Spinner } from "./ui";

type Candidate = { tags: ItemTags; thumb?: Blob; src?: string };
type Verdict = { count: number; similar?: { item: Item; score: number }; examples: EngineItem[][] };

const SIMILAR = 0.78;

function evaluate(c: Candidate, items: Item[]): Verdict {
  const closet = toEngine(items);
  const piece: EngineItem = { ...c.tags, id: "candidate", createdAt: 0, status: "active", wearCount: 0 };
  const { count, examples } = outfitsUnlocked(piece, closet);
  const similar = items
    .filter((i) => i.status !== "archived")
    .map((item) => ({ item, score: garmentSimilarity({ ...c.tags, description: c.tags.name }, toEngine([item])[0]) }))
    .sort((a, b) => b.score - a.score)[0];
  return { count, similar: similar && similar.score >= SIMILAR ? similar : undefined, examples };
}

function verdictText(v: Verdict) {
  if (v.similar) return { tone: "warn", title: "You own something similar", body: `Your ${v.similar.item.name.toLowerCase()} is a ${Math.round(v.similar.score * 100)}% match.` };
  if (v.count >= 6) return { tone: "good", title: "Great buy", body: `It works with your closet in ${v.count}+ good outfits.` };
  if (v.count >= 2) return { tone: "ok", title: "Good if you love it", body: `It makes ${v.count} good outfits with what you own.` };
  return { tone: "warn", title: "Think twice", body: "It doesn't pair with much in your closet yet." };
}

/** "Before you buy": will this piece actually work with my wardrobe? Plus best-value suggestions. */
export function BuyCheck() {
  const items = useItems();
  const profile = useProfile();
  const ai = useAiStatus();
  const wishlist = useLiveQuery(() => db.wishlist.orderBy("createdAt").reverse().toArray(), []);
  const [cand, setCand] = useState<Candidate>();
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();
  const [cat, setCat] = useState<Category>("top");
  const [sub, setSub] = useState<Subcategory>("t-shirt");
  const [colors, setColors] = useState<ColorName[]>([]);
  const [best, setBest] = useState<{ s: SamplePiece; count: number }[]>();
  const fileRef = useRef<HTMLInputElement>(null);

  const verdict = useMemo(() => (cand && items ? evaluate(cand, items) : undefined), [cand, items]);
  if (!items || !profile) return <Spinner />;

  const fromPhoto = async (file?: File) => {
    if (!file) return;
    setErr(undefined);
    setBusy("Reading the piece…");
    try {
      const thumb = await resizeImage(file, 480, { type: "image/webp", quality: 0.8 });
      let tags: ItemTags = { name: "New piece", category: cat, subcategory: sub, colors: await extractColors(thumb), pattern: "solid", formality: 2, warmth: 2, seasons: [], styles: [] };
      if (ai?.ai) {
        const small = await resizeImage(file, 1024, { type: "image/jpeg", quality: 0.85 });
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: await blobToBase64(small), mediaType: "image/jpeg", multi: false }),
        });
        const data = (await res.json()) as AnalyzeResult & { error?: string };
        if (res.ok && data.items[0]) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { box, ...t } = data.items[0];
          tags = t as ItemTags;
        }
      }
      setCand({ tags, thumb });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const fromManual = () => {
    if (!colors.length) return;
    setCand({
      tags: { name: `${colors[0]} ${subLabel(sub).toLowerCase()}`, category: cat, subcategory: sub, colors, pattern: "solid", formality: cat === "outerwear" ? 3 : 2, warmth: 2, seasons: [], styles: [] },
    });
  };

  const findBest = async () => {
    setBusy("Testing 40+ pieces against your closet…");
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    const owned = toEngine(items);
    const out: { s: SamplePiece; count: number }[] = [];
    for (const s of SAMPLES) {
      if (profile.wardrobe !== "both" && s.gender !== "u" && s.gender !== (profile.wardrobe === "womenswear" ? "w" : "m")) continue;
      const tags: ItemTags = { ...s };
      const dup = owned.some((o) => garmentSimilarity({ ...tags, description: s.name }, o) >= SIMILAR);
      if (dup) continue;
      out.push({ s, count: outfitsUnlocked({ ...tags, id: "candidate", createdAt: 0, status: "active", wearCount: 0 }, owned).count });
      if (out.length % 6 === 0) await new Promise((r) => setTimeout(r, 0)); // stay responsive
    }
    setBest(out.sort((a, b) => b.count - a.count).slice(0, 6));
    setBusy(undefined);
  };

  const v = verdict && verdictText(verdict);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <p className="text-sm text-muted">Thinking of buying something? Check how many outfits it makes with what you already own, before you pay.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={!!busy}>📷 Photo / screenshot</Button>
          <Button variant="secondary" onClick={fromManual} disabled={!colors.length || !!busy}>Check by type</Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c !== "accessory").map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => { setCat(c); setSub(SUBCATEGORIES[c][0]); }}>{CATEGORY_LABELS[c]}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(SUBCATEGORIES[cat] as readonly Subcategory[]).map((s) => (
              <Chip key={s} selected={sub === s} onClick={() => setSub(s)}>{subLabel(s)}</Chip>
            ))}
          </div>
          <ColorPicker value={colors} onChange={setColors} max={2} />
        </div>
        {busy && <p className="text-sm text-muted"><Spinner /> {busy}</p>}
        {err && <p className="text-sm text-bad">{err}</p>}

        {cand && verdict && v && (
          <Card className="pop-in space-y-3">
            <div className="flex gap-3">
              {cand.thumb ? <ItemImage blob={cand.thumb} alt="" className="h-24 w-20 shrink-0" /> : cand.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- bundled sample webp
                <img src={cand.src} alt="" className="product-photo h-24 w-20 shrink-0 object-contain" />
              ) : null}
              <div className="min-w-0">
                <p className="label text-muted">{cand.tags.name}</p>
                <p className={`display mt-1 text-[24px] ${v.tone === "good" ? "text-good" : v.tone === "warn" ? "text-bad" : ""}`}>{v.title}</p>
                <p className="text-sm text-muted">{v.body}</p>
              </div>
            </div>
            {verdict.examples.length > 0 && (
              <div>
                <p className="label mb-1.5 text-muted">Wear it with</p>
                {verdict.examples.slice(0, 2).map((ex, k) => (
                  <p key={k} className="text-[13px]">• {ex.filter((i) => i.id !== "candidate").map((i) => i.name).join(" + ")}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await db.wishlist.add({ ...cand.tags, id: uid(), createdAt: Date.now(), thumb: cand.thumb, src: cand.src, unlocks: verdict.count });
                  setCand(undefined);
                }}
              >
                ♡ Save to wishlist
              </Button>
              {shoppingLinks(shoppingQuery({ ...cand.tags, description: cand.tags.name }, profile.wardrobe)).slice(0, 2).map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="label inline-flex h-9 items-center rounded-btn border border-edge px-3">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle accent="the most outfits per euro.">Smart buys</SectionTitle>
        <p className="text-center text-sm text-muted">We test dozens of pieces against your closet and show the ones that would unlock the most new outfits.</p>
        <div className="flex justify-center">
          <Button size="sm" onClick={findBest} disabled={!!busy || items.length < 3}>Find my best buys</Button>
        </div>
        {best && best.length === 0 && (
          <p className="text-center text-sm text-muted">Nice — your closet already covers everything in our catalogue. Check a specific piece above instead.</p>
        )}
        {best && best.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
            {best.map(({ s, count }) => (
              <li key={s.key} className="text-center">
                <button className="block w-full" onClick={() => setCand({ tags: { ...s }, src: s.src })}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- bundled sample webp */}
                  <img src={s.src} alt={s.name} loading="lazy" className="product-photo tile cutout-bg aspect-[3/4] w-full object-contain p-2" />
                  <p className="mt-2 text-[12.5px] font-medium">{s.name}</p>
                  <p className="label mt-0.5 text-good">+{count} outfits</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!wishlist?.length && (
        <section className="space-y-3">
          <SectionTitle>Wishlist</SectionTitle>
          <ul className="space-y-2">
            {wishlist.map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-card border border-line bg-card p-2">
                {w.thumb ? <ItemImage blob={w.thumb} alt="" plain className="h-14 w-12 shrink-0" /> : w.src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- bundled sample webp
                  <img src={w.src} alt="" className="product-photo h-14 w-12 shrink-0 object-contain" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="label text-muted">{w.unlocks} outfits with your closet</p>
                </div>
                <button className="label px-2 text-muted" onClick={() => db.wishlist.delete(w.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
