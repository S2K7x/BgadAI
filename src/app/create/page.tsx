"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Button, Card, Chip, Empty, Meter, PageHeader, Spinner } from "@/components/ui";
import { toEngine, useItems, useProfile, useWeather } from "@/hooks/data";
import { db, logWorn, uid } from "@/lib/db";
import { generateOutfits, scoreOutfit, type EngineContext } from "@/lib/outfitEngine";
import { CATEGORY_LABELS, OCCASIONS, OCCASION_INFO, SLOTS, type Occasion, type Slot } from "@/lib/taxonomy";
import type { Item, Outfit } from "@/lib/types";

const randomSeed = () => Math.floor(Math.random() * 1e9);

export default function CreatePage() {
  const [tab, setTab] = useState<"build" | "saved">("build");
  return (
    <div>
      <PageHeader title="Create" subtitle="Build your own looks — we'll tell you how they score." />
      <div className="mb-5 grid grid-cols-2 rounded-full bg-soft p-1 text-sm font-medium">
        {(["build", "saved"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 rounded-full ${tab === t ? "bg-card shadow-sm" : "text-muted"}`}>
            {t === "build" ? "Build outfit" : "Saved outfits"}
          </button>
        ))}
      </div>
      {tab === "build" ? <Builder onSaved={() => setTab("saved")} /> : <Saved />}
    </div>
  );
}

function Builder({ onSaved }: { onSaved: () => void }) {
  const items = useItems();
  const profile = useProfile();
  const { weather } = useWeather(profile);
  const [sel, setSel] = useState<Partial<Record<Slot, string>>>({});
  const [occasion, setOccasion] = useState<Occasion>("casual");
  const [name, setName] = useState("");

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const chosen = Object.values(sel).map((id) => byId.get(id!)).filter((x): x is Item => !!x);
  const ctx: EngineContext = {
    occasion,
    tempC: weather ? (weather.feelsLikeC + weather.tempMaxC) / 2 : undefined,
    precipProb: weather?.precipProb,
    styleWeights: profile?.styleWeights,
    avoidColors: profile?.avoidColors,
  };
  const score = chosen.length >= 2 ? scoreOutfit(toEngine(chosen), ctx) : undefined;

  if (!items) return <Spinner />;
  if (!items.length)
    return (
      <Empty emoji="🧩" title="Nothing to build with yet">
        <Link href="/closet/add" className="underline">Add some clothes</Link> first.
      </Empty>
    );

  const pick = (slot: Slot, id?: string) => {
    setSel((s) => {
      const next = { ...s, [slot]: s[slot] === id ? undefined : id };
      if (slot === "onepiece" && next.onepiece) {
        delete next.top;
        delete next.bottom;
      }
      if ((slot === "top" || slot === "bottom") && next[slot]) delete next.onepiece;
      return next;
    });
  };

  const fillRest = () => {
    const { candidates } = generateOutfits(toEngine(items), { ...ctx, anchorIds: chosen.map((c) => c.id), seed: randomSeed() }, 1);
    const c = candidates[0];
    if (!c) return;
    const next: Partial<Record<Slot, string>> = {};
    for (const p of c.pieces) next[p.slot] = p.itemId;
    setSel(next);
  };

  const save = async () => {
    await db.outfits.add({
      id: uid(),
      createdAt: Date.now(),
      name: name.trim() || `${OCCASION_INFO[occasion].label} look`,
      source: "manual",
      occasion,
      pieces: (Object.entries(sel) as [Slot, string | undefined][]).filter(([, v]) => v).map(([slot, itemId]) => ({ slot, itemId: itemId! })),
    });
    setSel({});
    setName("");
    onSaved();
  };

  return (
    <div className="space-y-5">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {OCCASIONS.map((o) => (
          <Chip key={o} selected={occasion === o} onClick={() => setOccasion(o)}>
            {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
          </Chip>
        ))}
      </div>

      <Card>
        {chosen.length ? <OutfitBoard items={chosen} compact /> : <p className="py-10 text-center text-sm text-muted">Pick pieces below to start.</p>}
        {score && (
          <div className="mt-3 space-y-1.5">
            <p className="text-sm font-medium">Match {Math.round(score.total * 100)}%</p>
            <Meter label="Colours" value={score.color} />
            <Meter label="Occasion" value={score.formality} />
            <Meter label="Weather" value={score.weather} />
            <Meter label="Your style" value={score.style} />
            {score.notes.map((n) => (
              <p key={n} className="text-xs text-muted">• {n}</p>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={fillRest}>✨ Complete it for me</Button>
          {chosen.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSel({})}>Clear</Button>
          )}
        </div>
      </Card>

      {SLOTS.map((slot) => {
        const options = items.filter((i) => i.category === slot && i.status !== "archived");
        if (!options.length) return null;
        return (
          <section key={slot}>
            <h3 className="mb-2 text-sm font-semibold">{CATEGORY_LABELS[slot]}</h3>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {options.map((i) => (
                <button
                  key={i.id}
                  onClick={() => pick(slot, i.id)}
                  aria-pressed={sel[slot] === i.id}
                  className={`shrink-0 rounded-2xl p-0.5 ${sel[slot] === i.id ? "ring-2 ring-ink" : ""}`}
                >
                  <ItemImage blob={i.thumb} alt={i.name} className="h-20 w-20 rounded-[14px]" />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {chosen.length >= 2 && (
        <div className="sticky bottom-24 z-20 flex gap-2 rounded-full border border-line bg-card p-1.5 shadow-lg">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this look" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      )}
    </div>
  );
}

function Saved() {
  const outfits = useLiveQuery(() => db.outfits.orderBy("createdAt").reverse().toArray(), []);
  const items = useItems();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const [msg, setMsg] = useState<string>();

  if (!outfits || !items) return <Spinner />;
  if (!outfits.length)
    return (
      <Empty emoji="💾" title="No saved outfits yet">
        Save suggestions from Today, build your own, or recreate an inspiration look.
      </Empty>
    );

  const sorted = [...outfits].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));
  return (
    <ul className="space-y-4">
      {msg && <p className="text-sm text-good">{msg}</p>}
      {sorted.map((o: Outfit) => {
        const its = o.pieces.map((p) => byId.get(p.itemId)).filter((x): x is Item => !!x);
        return (
          <li key={o.id} className="rounded-[28px] border border-line bg-card p-3">
            <OutfitBoard items={its} compact />
            <div className="px-1 pt-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{o.name}</p>
                <span className="text-xs text-muted">
                  {o.source === "ai" ? "✨ AI" : o.source === "inspo" ? "🖼️ Inspo" : "✋ Yours"}
                  {o.occasion && ` · ${OCCASION_INFO[o.occasion].label}`}
                </span>
              </div>
              {o.explanation && <p className="mt-1 text-sm text-muted">{o.explanation}</p>}
              {its.length < o.pieces.length && <p className="mt-1 text-xs text-bad">Some pieces were deleted from your closet.</p>}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await logWorn(its.map((i) => i.id), o.id);
                    setMsg(`Logged "${o.name}" as worn today ✓`);
                  }}
                >
                  Wear today
                </Button>
                <Button size="sm" variant="secondary" onClick={() => db.outfits.update(o.id, { favorite: !o.favorite })}>
                  {o.favorite ? "★ Favourite" : "☆ Favourite"}
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => confirm("Delete this outfit?") && db.outfits.delete(o.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
