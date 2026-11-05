"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Button, Card, Chip, Empty, Meter, Sheet, Spinner } from "@/components/ui";
import { toEngine, useAiStatus, useItems, useProfile, useWeather } from "@/hooks/data";
import { db, logWorn, today, uid } from "@/lib/db";
import { explain, generateOutfits, scoreOutfit, swapOptions, type Candidate, type EngineContext } from "@/lib/outfitEngine";
import { topStyles } from "@/lib/style";
import { CATEGORY_LABELS, OCCASIONS, OCCASION_INFO, STYLE_INFO, type Occasion } from "@/lib/taxonomy";
import type { Item } from "@/lib/types";

export default function TodayPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Today />
    </Suspense>
  );
}

const dayIndex = () => Math.floor(Date.now() / 86_400_000);

type Shown = Candidate & { key: string; title?: string; aiNote?: string };

function Today() {
  const anchorId = useSearchParams().get("anchor") ?? undefined;
  const profile = useProfile();
  const items = useItems();
  const ai = useAiStatus();
  const { weather, loading: wLoading, error: wError } = useWeather(profile);
  const feedback = useLiveQuery(() => db.feedback.toArray(), []);
  const wornToday = useLiveQuery(() => db.wearLogs.where("date").equals(today()).count(), []);
  const [occasion, setOccasion] = useState<Occasion>();
  const [shuffle, setShuffle] = useState(0);
  const [day] = useState(dayIndex);
  // Local tweaks are tied to the current inputs, so they reset when occasion/shuffle/anchor change.
  const resetKey = `${occasion}|${shuffle}|${anchorId}`;
  const [ov, setOv] = useState<{ k: string; v: Record<string, string[]> }>();
  const overrides = useMemo(() => (ov?.k === resetKey ? ov.v : {}), [ov, resetKey]);
  const setOverrides = (fn: (o: Record<string, string[]>) => Record<string, string[]>) => setOv({ k: resetKey, v: fn(overrides) });
  const [picks, setPicks] = useState<{ k: string; v: { id: string; title: string; explanation: string }[] }>();
  const aiPicks = picks?.k === resetKey ? picks.v : undefined;
  const setAiPicks = (v: { id: string; title: string; explanation: string }[]) => setPicks({ k: resetKey, v });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>();
  const [swap, setSwap] = useState<{ key: string; item: Item }>();
  const [toast, setToast] = useState<string>();

  const occ: Occasion = occasion ?? profile?.lifestyle[0] ?? "casual";
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const anchor = anchorId ? byId.get(anchorId) : undefined;

  const ctx: EngineContext = useMemo(
    () => ({
      occasion: occ,
      tempC: weather ? (weather.feelsLikeC + weather.tempMaxC) / 2 : undefined,
      precipProb: weather?.precipProb,
      styleWeights: profile?.styleWeights,
      avoidColors: profile?.avoidColors,
      feedback,
      anchorIds: anchor ? [anchor.id] : undefined,
      seed: day + shuffle * 7919,
    }),
    [occ, weather, profile, feedback, anchor, shuffle, day],
  );

  const engineItems = useMemo(() => toEngine(items ?? []), [items]);
  const result = useMemo(() => generateOutfits(engineItems, ctx, 6), [engineItems, ctx]);

  const shown: Shown[] = useMemo(() => {
    const keyed = result.candidates.map((c, i) => ({ ...c, key: `c${i}` }));
    let list: Shown[] = keyed.slice(0, 3);
    if (aiPicks?.length) {
      list = aiPicks.flatMap((p): Shown[] => {
        const c = keyed.find((k) => k.key === p.id);
        return c ? [{ ...c, title: p.title, aiNote: p.explanation }] : [];
      });
    }
    return list.map((c) => {
      const ids = overrides[c.key];
      if (!ids) return c;
      const its = ids.map((id) => byId.get(id)).filter((x): x is Item => !!x);
      const eng = toEngine(its);
      const score = scoreOutfit(eng, ctx);
      return { ...c, items: eng, pieces: eng.map((i) => ({ slot: i.category, itemId: i.id })), score, explanation: explain(eng, score, ctx), aiNote: undefined };
    });
  }, [result, aiPicks, overrides, byId, ctx]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(undefined), 2200);
  };

  const askStylist = async () => {
    setAiLoading(true);
    setAiError(undefined);
    try {
      const top = profile ? topStyles(profile.styleWeights).map((s) => `${STYLE_INFO[s.style].label} ${s.pct}%`).join(", ") : undefined;
      const res = await fetch("/api/ai/stylist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occasion: occ,
          weather: weather ? `${Math.round(weather.tempMinC)}–${Math.round(weather.tempMaxC)}°C, ${weather.summary}, ${weather.precipProb}% chance of rain` : undefined,
          styleSummary: top,
          pick: 3,
          candidates: result.candidates.map((c, i) => ({
            id: `c${i}`,
            score: c.score.total,
            pieces: c.items.map((it) => `${it.colors.join("/")} ${it.pattern !== "solid" ? it.pattern + " " : ""}${it.subcategory} ("${it.name}")`),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stylist failed");
      setAiPicks(data.picks);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  if (!items || !profile) return <Spinner />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">{greeting}</h1>
      </header>

      <WeatherCard profile={profile} weather={weather} loading={wLoading} error={wError} />

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {OCCASIONS.map((o) => (
          <Chip key={o} selected={occ === o} onClick={() => setOccasion(o)}>
            {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
          </Chip>
        ))}
      </div>

      {anchor && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-2 pr-3">
          <ItemImage blob={anchor.thumb} alt={anchor.name} className="h-12 w-12 rounded-xl" />
          <p className="flex-1 text-sm">
            Styling your <b>{anchor.name}</b>
          </p>
          <Link href="/" className="text-sm text-muted">✕</Link>
        </div>
      )}

      {result.candidates.length === 0 ? (
        <div className="mt-6">
          <Empty emoji="👗" title={items.length ? "Almost there" : "Let's build your closet"}>
            <p>
              {items.length
                ? `Add ${result.missing.map((m) => CATEGORY_LABELS[m].toLowerCase()).join(" and ")} so we can complete an outfit${
                    items.length ? ` for ${OCCASION_INFO[occ].label.toLowerCase()}` : ""
                  }.`
                : "Add a few pieces and your first outfits appear here."}
            </p>
            <Link href={`/closet/add${items.length < 5 ? "?quick=1" : ""}`}>
              <Button className="mt-4">Add clothes</Button>
            </Link>
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between">
            <h2 className="font-semibold">{aiPicks ? "Your stylist's picks" : "Outfits for you"}</h2>
            <div className="flex gap-2">
              {ai?.ai && !aiPicks && (
                <Button size="sm" variant="secondary" onClick={askStylist} disabled={aiLoading}>
                  {aiLoading ? <Spinner /> : "✨ Stylist picks"}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setShuffle((s) => s + 1)} aria-label="Shuffle outfits">
                ↻
              </Button>
            </div>
          </div>
          {aiError && <p className="mt-2 text-sm text-bad">{aiError}</p>}
          {wornToday ? <p className="mt-2 text-sm text-good">✓ Today&apos;s outfit is logged.</p> : null}

          <ul className="mt-3 space-y-4">
            {shown.map((c, idx) => (
              <OutfitCard
                key={c.key + (overrides[c.key]?.join() ?? "")}
                c={c}
                rank={idx}
                byId={byId}
                onSwapPiece={(item) => setSwap({ key: c.key, item })}
                onRate={async (r) => {
                  await db.feedback.add({ id: uid(), createdAt: Date.now(), itemIds: c.items.map((i) => i.id), rating: r });
                  flash(r > 0 ? "Noted — more like this 👍" : "Got it — fewer like this");
                }}
                onSave={async () => {
                  await db.outfits.add({
                    id: uid(),
                    createdAt: Date.now(),
                    name: c.title ?? `${OCCASION_INFO[occ].label} look`,
                    source: "ai",
                    occasion: occ,
                    pieces: c.pieces,
                    explanation: c.aiNote ?? c.explanation,
                  });
                  flash("Saved to your outfits");
                }}
                onWear={async () => {
                  await logWorn(c.items.map((i) => i.id));
                  flash("Logged as today's outfit ✓");
                }}
              />
            ))}
          </ul>
        </>
      )}

      <Sheet open={!!swap} onClose={() => setSwap(undefined)} title={swap ? `Swap ${swap.item.name}` : ""}>
        {swap && (
          <SwapList
            outfit={shown.find((s) => s.key === swap.key)?.items ?? []}
            target={swap.item}
            all={engineItems}
            ctx={ctx}
            byId={byId}
            onPick={(newId) => {
              const current = shown.find((s) => s.key === swap.key)!;
              setOverrides((o) => ({ ...o, [swap.key]: current.items.map((i) => (i.id === swap.item.id ? newId : i.id)) }));
              setSwap(undefined);
            }}
          />
        )}
      </Sheet>

      {toast && (
        <div role="status" className="pop-in fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function WeatherCard({
  profile,
  weather,
  loading,
  error,
}: {
  profile: NonNullable<ReturnType<typeof useProfile>>;
  weather?: ReturnType<typeof useWeather>["weather"];
  loading: boolean;
  error?: string;
}) {
  if (!profile.city)
    return (
      <Link href="/me#city" className="flex items-center justify-between rounded-3xl border border-dashed border-line p-4 text-sm">
        <span>🌤️ Add your city for weather-smart outfits</span>
        <span className="text-muted">→</span>
      </Link>
    );
  return (
    <Card className="flex items-center gap-4">
      <span className="text-4xl">{weather?.emoji ?? "🌡️"}</span>
      <div className="flex-1">
        {error ? (
          <p className="text-sm text-muted">Couldn&apos;t load the forecast for {profile.city.name} — outfits ignore weather for now.</p>
        ) : loading || !weather ? (
          <p className="text-sm text-muted">Getting the forecast for {profile.city.name}…</p>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {Math.round(weather.tempC)}°C <span className="text-sm font-normal text-muted">feels {Math.round(weather.feelsLikeC)}°</span>
            </p>
            <p className="text-sm text-muted">
              {weather.summary} · {Math.round(weather.tempMinC)}–{Math.round(weather.tempMaxC)}° · ☔ {weather.precipProb}% · {profile.city.name}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function OutfitCard({
  c,
  rank,
  byId,
  onSwapPiece,
  onRate,
  onSave,
  onWear,
}: {
  c: Shown;
  rank: number;
  byId: Map<string, Item>;
  onSwapPiece: (i: Item) => void;
  onRate: (r: 1 | -1) => void;
  onSave: () => void;
  onWear: () => void;
}) {
  const [why, setWhy] = useState(false);
  const [rated, setRated] = useState<1 | -1>();
  const items = c.items.map((i) => byId.get(i.id)).filter((x): x is Item => !!x);
  return (
    <li className="pop-in rounded-[28px] border border-line bg-card p-3" style={{ animationDelay: `${rank * 60}ms` }}>
      <OutfitBoard items={items} onPieceClick={onSwapPiece} />
      <div className="px-1 pt-3">
        {c.title && <p className="font-display text-lg font-semibold">{c.title}</p>}
        <p className="text-sm leading-relaxed">{c.aiNote ?? c.explanation}</p>
        <button className="mt-1 text-xs text-muted underline" onClick={() => setWhy(!why)}>
          {why ? "Hide" : "Why this outfit?"} · match {Math.round(c.score.total * 100)}%
        </button>
        {why && (
          <div className="mt-2 space-y-1.5">
            <Meter label="Colours" value={c.score.color} />
            <Meter label="Occasion" value={c.score.formality} />
            <Meter label="Weather" value={c.score.weather} />
            <Meter label="Your style" value={c.score.style} />
            <Meter label="Freshness" value={c.score.freshness} />
            {c.score.notes.slice(1).map((n) => (
              <p key={n} className="text-xs text-muted">• {n}</p>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={onWear}>Wear today</Button>
          <Button size="sm" variant="secondary" onClick={onSave}>Save</Button>
          <div className="ml-auto flex gap-1">
            {([1, -1] as const).map((r) => (
              <button
                key={r}
                aria-label={r > 0 ? "Like" : "Dislike"}
                disabled={!!rated}
                onClick={() => {
                  setRated(r);
                  onRate(r);
                }}
                className={`grid h-9 w-9 place-items-center rounded-full border ${rated === r ? "border-ink bg-ink text-bg" : "border-line"} disabled:opacity-60`}
              >
                {r > 0 ? "👍" : "👎"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

function SwapList({
  outfit,
  target,
  all,
  ctx,
  byId,
  onPick,
}: {
  outfit: Candidate["items"];
  target: Item;
  all: Candidate["items"];
  ctx: EngineContext;
  byId: Map<string, Item>;
  onPick: (id: string) => void;
}) {
  const opts = swapOptions(outfit, target.id, all, ctx, 12);
  if (!opts.length) return <p className="py-6 text-center text-sm text-muted">No other {CATEGORY_LABELS[target.category].toLowerCase()} to swap in yet.</p>;
  return (
    <ul className="grid grid-cols-3 gap-2.5 pb-4">
      {opts.map(({ item, score }) => {
        const full = byId.get(item.id)!;
        return (
          <li key={item.id}>
            <button onClick={() => onPick(item.id)} className="w-full text-left">
              <ItemImage blob={full.thumb} alt={item.name} className="aspect-square rounded-2xl" />
              <p className="mt-1 truncate text-xs">{item.name}</p>
              <p className="text-[11px] text-muted">match {Math.round(score * 100)}%</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
