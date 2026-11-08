"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { BuyCheck } from "@/components/BuyCheck";
import { PieceImage } from "@/components/PieceImage";
import { ItemImage } from "@/components/ItemImage";
import { Button, Card, Chip, ColorPicker, Empty, PageHeader, Sheet, Spinner } from "@/components/ui";
import { toEngine, useAiStatus, useItems, useProfile } from "@/hooks/data";
import type { InspoResult } from "@/lib/ai/schemas";
import { db, uid } from "@/lib/db";
import { blobToBase64, resizeImage } from "@/lib/image";
import { matchInspiration, shoppingLinks, shoppingQuery, type GarmentMatch } from "@/lib/matching";
import { CATEGORIES, CATEGORY_LABELS, SUBCATEGORIES, categoryOf, subLabel, type Category, type ColorName, type Subcategory } from "@/lib/taxonomy";
import type { DetectedGarment, Inspiration, Item } from "@/lib/types";

export default function InspoPage() {
  const [tab, setTab] = useState<"recreate" | "buy">("recreate");
  return (
    <div>
      <PageHeader
        title="Inspo"
        accent={tab === "recreate" ? "Love it? Rebuild it." : "Buy less, wear more."}
        subtitle={tab === "recreate" ? "Upload a look you love — we'll rebuild it from your closet and find the missing pieces." : undefined}
      />
      <div className="mb-5 grid grid-cols-2 border-b border-line">
        {(["recreate", "buy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`label -mb-px h-10 border-b-2 ${tab === t ? "border-ink text-ink dark:border-accent-text" : "border-transparent text-muted"}`}
          >
            {t === "recreate" ? "Recreate a look" : "Before you buy"}
          </button>
        ))}
      </div>
      {tab === "recreate" ? <RecreateLook /> : <BuyCheck />}
    </div>
  );
}

function RecreateLook() {
  const ai = useAiStatus();
  const items = useItems();
  const profile = useProfile();
  const inspirations = useLiveQuery(() => db.inspirations.orderBy("createdAt").reverse().toArray(), []);
  const [activeId, setActiveId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [summary, setSummary] = useState<string>();
  const [shop, setShop] = useState<DetectedGarment>();
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = inspirations?.find((i) => i.id === activeId) ?? (activeId ? undefined : inspirations?.[0]);
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const matches = useMemo(
    () => (active && items ? matchInspiration(active.garments, toEngine(items)) : []),
    [active, items],
  );

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(undefined);
    setSummary(undefined);
    setSaved(false);
    setBusy("Preparing photo…");
    try {
      const image = await resizeImage(file, 1280, { type: "image/jpeg", quality: 0.88 });
      let garments: DetectedGarment[] = [];
      if (ai?.ai) {
        setBusy("Breaking down the look…");
        const small = await resizeImage(image, 1024, { type: "image/jpeg", quality: 0.85 });
        const res = await fetch("/api/ai/inspo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: await blobToBase64(small), mediaType: "image/jpeg" }),
        });
        const data = (await res.json()) as InspoResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");
        garments = data.garments as DetectedGarment[];
        setSummary(data.summary);
      }
      const insp: Inspiration = { id: uid(), createdAt: Date.now(), image, garments };
      await db.inspirations.add(insp);
      setActiveId(insp.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const saveOutfit = async (ms: GarmentMatch[]) => {
    const owned = ms.filter((m) => m.owned && m.best);
    await db.outfits.add({
      id: uid(),
      createdAt: Date.now(),
      name: "Inspired look",
      source: "inspo",
      pieces: owned.map((m) => ({ slot: m.best!.item.category, itemId: m.best!.item.id })),
      explanation: summary,
    });
    setSaved(true);
  };

  if (!items || !inspirations || !profile) return <Spinner />;

  const ownedCount = matches.filter((m) => m.owned).length;

  return (
    <div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={!!busy}
        className="flex w-full items-center justify-center gap-3 rounded-card bg-ink py-5 text-bg dark:border dark:border-line dark:bg-card dark:text-ink active:scale-[0.99] disabled:opacity-70"
      >
        {busy ? (
          <>
            <Spinner /> {busy}
          </>
        ) : (
          <>
            <span className="text-2xl">🖼️</span> Upload an outfit photo
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {!ai?.ai && ai !== undefined && (
        <p className="mt-2 text-xs text-muted">AI is off — after uploading, add the pieces you see by hand and we&apos;ll match them.</p>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      {active ? (
        <section className="mt-6">
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <ItemImage blob={active.image} alt="Inspiration" fit="cover" className="aspect-[3/4] rounded-card" />
            <div className="flex flex-col justify-center">
              <p className="display text-[44px]">
                {ownedCount}/{matches.length || 0}
              </p>
              <p className="text-sm text-muted">pieces found in your closet</p>
              {summary && active.id === activeId && <p className="mt-2 text-sm">{summary}</p>}
              {ownedCount >= 2 && (
                <Button size="sm" className="mt-3 self-start" onClick={() => saveOutfit(matches)} disabled={saved}>
                  {saved ? "✓ Saved" : "Save my version"}
                </Button>
              )}
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {matches.map((m, i) => (
              <MatchRow key={i} m={m} byId={byId} onShop={() => setShop(m.garment)} onRemove={async () => {
                await db.inspirations.update(active.id, { garments: active.garments.filter((_, j) => j !== i) });
              }} />
            ))}
          </ul>

          <ManualGarment onAdd={(g) => db.inspirations.update(active.id, { garments: [...active.garments, g] })} />

          <button className="mt-4 text-xs text-muted underline" onClick={async () => {
            if (!confirm("Delete this inspiration?")) return;
            await db.inspirations.delete(active.id);
            setActiveId(undefined);
          }}>
            Delete this inspiration
          </button>
        </section>
      ) : (
        <div className="mt-6">
          <Empty emoji="📌" title="No inspiration yet">
            Screenshots from Pinterest, Instagram or street style all work.
          </Empty>
        </div>
      )}

      {inspirations.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Previous looks</h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {inspirations.map((i) => (
              <button key={i.id} onClick={() => { setActiveId(i.id); setSummary(undefined); setSaved(false); }} className={`shrink-0 rounded-tile p-0.5 ${active?.id === i.id ? "ring-2 ring-ink" : ""}`}>
                <ItemImage blob={i.image} alt="" fit="cover" className="h-24 w-[72px] rounded-tile" />
              </button>
            ))}
          </div>
        </section>
      )}

      <Sheet open={!!shop} onClose={() => setShop(undefined)} title="Shop similar">
        {shop && <ShopPanel garment={shop} wardrobe={profile.wardrobe} shopping={!!ai?.shopping} />}
      </Sheet>
    </div>
  );
}

function MatchRow({ m, byId, onShop, onRemove }: { m: GarmentMatch; byId: Map<string, Item>; onShop: () => void; onRemove: () => void }) {
  const owned = m.owned && m.best ? byId.get(m.best.item.id) : undefined;
  const close = !m.owned && m.best ? byId.get(m.best.item.id) : undefined;
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-card p-2.5">
      <div className="cutout-bg grid h-16 w-16 shrink-0 place-items-center rounded-tile">
        <PieceImage sub={m.garment.subcategory} color={m.garment.colors[0] ?? "grey"} className="h-14 w-12" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.garment.description || m.garment.subcategory}</p>
        {owned ? (
          <p className="text-xs text-good">✓ You own this · {Math.round(m.best!.score * 100)}% match</p>
        ) : (
          <p className="text-xs text-muted">{close ? `Closest: ${close.name} (${Math.round(m.best!.score * 100)}%)` : "Not in your closet"}</p>
        )}
        <div className="mt-1 flex gap-3 text-xs">
          {!owned && <button onClick={onShop} className="font-medium text-accent-text">Shop similar →</button>}
          <button onClick={onRemove} className="text-muted">remove</button>
        </div>
      </div>
      {(owned ?? close) && <ItemImage blob={(owned ?? close)!.thumb} alt="" className={`h-16 w-16 shrink-0 rounded-tile ${owned ? "" : "opacity-50"}`} />}
    </li>
  );
}

function ManualGarment({ onAdd }: { onAdd: (g: DetectedGarment) => void }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Category>("top");
  const [sub, setSub] = useState<Subcategory>("t-shirt");
  const [colors, setColors] = useState<ColorName[]>([]);
  if (!open)
    return (
      <button className="mt-3 w-full rounded-tile border border-dashed border-line py-3 text-sm text-muted" onClick={() => setOpen(true)}>
        + Add a piece by hand
      </button>
    );
  return (
    <Card className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => { setCat(c); setSub(SUBCATEGORIES[c][0]); }}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(SUBCATEGORIES[cat] as readonly Subcategory[]).map((s) => (
          <Chip key={s} selected={sub === s} onClick={() => setSub(s)}>{subLabel(s)}</Chip>
        ))}
      </div>
      <ColorPicker value={colors} onChange={setColors} max={2} />
      <Button
        size="sm"
        disabled={!colors.length}
        onClick={() => {
          onAdd({ category: categoryOf(sub) ?? cat, subcategory: sub, colors, pattern: "solid", formality: 2, styles: [], description: `${colors[0]} ${subLabel(sub).toLowerCase()}` });
          setColors([]);
          setOpen(false);
        }}
      >
        Add piece
      </Button>
    </Card>
  );
}

type Product = { title: string; price: string; source: string; link: string; thumbnail: string };

function ShopPanel({ garment, wardrobe, shopping }: { garment: DetectedGarment; wardrobe: "womenswear" | "menswear" | "both"; shopping: boolean }) {
  const [q, setQ] = useState(shoppingQuery(garment, wardrobe));
  const [results, setResults] = useState<Product[]>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>();

  const search = async () => {
    setLoading(true);
    setErr(undefined);
    try {
      const res = await fetch(`/api/shop?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <p className="text-sm text-muted">{garment.description}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full rounded-btn border border-edge bg-bg px-4 text-sm" />
      {shopping && (
        <Button className="w-full" onClick={search} disabled={loading}>
          {loading ? <Spinner /> : "Find products"}
        </Button>
      )}
      {err && <p className="text-sm text-bad">{err}</p>}
      {results && (
        <ul className="grid grid-cols-2 gap-3">
          {results.map((r) => (
            <li key={r.link}>
              <a href={r.link} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote merchant thumbnails */}
                {r.thumbnail && <img src={r.thumbnail} alt="" className="aspect-square w-full rounded-tile bg-soft object-contain" />}
                <p className="mt-1 line-clamp-2 text-xs">{r.title}</p>
                <p className="text-xs font-semibold">{r.price} <span className="font-normal text-muted">· {r.source}</span></p>
              </a>
            </li>
          ))}
          {!results.length && <p className="col-span-2 text-sm text-muted">No products found — try editing the search.</p>}
        </ul>
      )}
      <div className="space-y-2">
        {shoppingLinks(q).map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-tile border border-line px-4 py-3 text-sm">
            {l.label} <span className="text-muted">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
