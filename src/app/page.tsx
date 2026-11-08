"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { OutfitBoard } from "@/components/OutfitBoard";
import { SampleClosetButton } from "@/components/SampleClosetButton";
import { Hero, type HeroVisual } from "@/components/Hero";
import { Button, Chip, Empty, Meter, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { toEngine, useAiStatus, useItems, useProfile, useWeather } from "@/hooks/data";
import { db, logWorn, today, uid } from "@/lib/db";
import { outfitCard, pollCard, shareImage } from "@/lib/share";
import { explain, generateOutfits, MOOD_INFO, MOODS, scoreOutfit, type Mood, swapOptions, type Candidate, type EngineContext } from "@/lib/outfitEngine";
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
  const [mood, setMood] = useState<Mood>();
  const todaysPlan = useLiveQuery(() => db.plans.get(today()), []);
  const [shuffle, setShuffle] = useState(0);
  const [day] = useState(dayIndex);
  // Local tweaks are tied to the current inputs, so they reset when occasion/shuffle/anchor change.
  const resetKey = `${occasion}|${shuffle}|${anchorId}|${mood}`;
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
      mood,
    }),
    [occ, weather, profile, feedback, anchor, shuffle, day, mood],
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

  const first = shown[0]?.items.map((i) => byId.get(i.id)).filter((x): x is Item => !!x) ?? [];
  const heroItems = [
    first.find((i) => i.category === "top" || i.category === "onepiece") ?? anchor,
    first.find((i) => i.category === "bottom" || i.category === "outerwear"),
  ].filter((x): x is Item => !!x);
  const heroVisuals: HeroVisual[] = heroItems.length
    ? heroItems.map((i) => ({ kind: "photo", blob: i.thumb, alt: i.name }))
    : [
        { kind: "garment", sub: "coat", color: "camel" },
        { kind: "garment", sub: "t-shirt", color: "white" },
      ];

  if (!items || !profile) return <Spinner />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <Hero
        word="Today"
        accent={anchor ? `styled around your ${anchor.name.toLowerCase()}` : "Styled for you."}
        visuals={heroVisuals}
        left={
          <>
            <p className="label text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="display mt-1 text-[22px]">{greeting}</p>
          </>
        }
        right={<WeatherCard profile={profile} weather={weather} loading={wLoading} error={wError} />}
      />

      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
        {OCCASIONS.map((o) => (
          <Chip key={o} selected={occ === o} onClick={() => setOccasion(o)}>
            {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4">
        <span className="label shrink-0 text-muted">Feeling</span>
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(mood === m ? undefined : m)}
            aria-pressed={mood === m}
            className={`label h-7 shrink-0 rounded-btn px-2.5 ${mood === m ? "bg-accent text-accent-ink" : "text-ink hover:bg-soft"}`}
          >
            {MOOD_INFO[m].emoji} {MOOD_INFO[m].label}
          </button>
        ))}
      </div>

      {todaysPlan && todaysPlan.itemIds.length > 0 && !wornToday && (
        <div className="mt-5 rounded-card border border-edge bg-card p-3">
          <p className="label mb-2 text-muted">Planned for today</p>
          <OutfitBoard items={todaysPlan.itemIds.map((id) => byId.get(id)).filter((x): x is Item => !!x)} compact />
          <Button
            size="sm"
            className="mt-3"
            onClick={async () => {
              await logWorn(todaysPlan.itemIds, todaysPlan.outfitId);
              flash("Logged as today's outfit ✓");
            }}
          >
            Wear it
          </Button>
        </div>
      )}

      {anchor && (
        <div className="mt-4 flex items-center gap-3 rounded-tile border border-line bg-card p-2 pr-3">
          <ItemImage blob={anchor.thumb} alt={anchor.name} className="h-12 w-12 rounded-tile" />
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
            {items.length === 0 && <SampleClosetButton className="mt-2" />}
          </Empty>
        </div>
      ) : (
        <>
          <SectionTitle className="mt-8" accent={weather ? `picked for ${Math.round(weather.feelsLikeC)}°C` : `for ${OCCASION_INFO[occ].label.toLowerCase()}`}>
            {aiPicks ? "Stylist picks" : "Your outfits"}
          </SectionTitle>
          <div className="mt-4 flex items-center justify-center">
            <div className="flex gap-2">
              {ai?.ai && !aiPicks && (
                <Button size="sm" variant="secondary" onClick={askStylist} disabled={aiLoading}>
                  {aiLoading ? <Spinner /> : "✨ Stylist picks"}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setShuffle((s) => s + 1)} aria-label="Shuffle outfits">
                ↻
              </Button>
              {shown.length >= 2 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const pieces = (c: Shown) => c.items.map((i) => ({ blob: byId.get(i.id)?.thumb }));
                    const r = await shareImage(await pollCard(pieces(shown[0]), pieces(shown[1])), "a-or-b.png", "Which one should I wear today? A or B?");
                    if (r === "downloaded") flash("Poll image saved — send it to friends");
                  }}
                >
                  A or B?
                </Button>
              )}
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
                onShare={async () => {
                  const blob = await outfitCard(c.title ?? "Today's look", c.aiNote ?? c.explanation, c.items.map((i) => ({ blob: byId.get(i.id)?.thumb })));
                  const r = await shareImage(blob, "outfit.png", "My outfit today, styled from my own closet");
                  if (r === "downloaded") flash("Outfit image saved");
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
        <div role="status" className="pop-in fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-btn bg-accent px-4 py-2.5 text-[12px] font-semibold tracking-wide text-accent-ink uppercase shadow-lg">
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
  const box = "block w-[148px] rounded-card border border-line bg-card/90 p-3";
  if (!profile.city)
    return (
      <Link href="/me#city" className={box}>
        <p className="display text-[16px]">Add your city</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">For weather-proof outfits.</p>
        <p className="label mt-2">Set it →</p>
      </Link>
    );
  return (
    <div className={box}>
      <p className="label text-muted">{profile.city.name}</p>
      {error ? (
        <p className="mt-1 text-[11px] leading-snug text-muted">Forecast unavailable — outfits ignore weather for now.</p>
      ) : loading || !weather ? (
        <p className="mt-1 text-[11px] text-muted">Getting forecast…</p>
      ) : (
        <>
          <p className="display mt-1 text-[30px]">
            {Math.round(weather.tempC)}°<span className="ml-1 text-[18px]">{weather.emoji}</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            {weather.summary} · {Math.round(weather.tempMinC)}–{Math.round(weather.tempMaxC)}° · ☔ {weather.precipProb}%
          </p>
        </>
      )}
    </div>
  );
}

function OutfitCard({
  c,
  rank,
  byId,
  onSwapPiece,
  onRate,
  onSave,
  onShare,
  onWear,
}: {
  c: Shown;
  rank: number;
  byId: Map<string, Item>;
  onSwapPiece: (i: Item) => void;
  onRate: (r: 1 | -1) => void;
  onSave: () => void;
  onShare: () => void;
  onWear: () => void;
}) {
  const [why, setWhy] = useState(false);
  const [rated, setRated] = useState<1 | -1>();
  const items = c.items.map((i) => byId.get(i.id)).filter((x): x is Item => !!x);
  return (
    <li className="pop-in rounded-card border border-line bg-card p-3" style={{ animationDelay: `${rank * 60}ms` }}>
      <OutfitBoard items={items} onPieceClick={onSwapPiece} />
      <div className="px-1 pt-3">
        {c.title && <p className="display text-[22px]">{c.title}</p>}
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
          <Button size="sm" variant="ghost" onClick={onShare} aria-label="Share outfit">Share</Button>
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
                className={`grid h-9 w-9 place-items-center rounded-btn border ${rated === r ? "border-ink bg-ink text-bg dark:border dark:border-line dark:bg-card dark:text-ink" : "border-line"} disabled:opacity-60`}
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
              <ItemImage blob={full.thumb} alt={item.name} className="aspect-square rounded-tile" />
              <p className="mt-1 truncate text-xs">{item.name}</p>
              <p className="text-[11px] text-muted">match {Math.round(score * 100)}%</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
