"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Garment } from "@/components/Garment";
import { Hero } from "@/components/Hero";
import { Button, Chip, ColorPicker, SectionTitle, Spinner } from "@/components/ui";
import { saveProfile } from "@/lib/db";
import { looksFor, normalise, topStyles, weightsFromSwipes, type Look } from "@/lib/style";
import { OCCASIONS, OCCASION_INFO, STYLES, STYLE_INFO, type ColorName, type Occasion, type Style } from "@/lib/taxonomy";
import type { StyleProfile } from "@/lib/types";
import { searchCity, type GeoResult } from "@/lib/weather";

type Step = "welcome" | "basics" | "city" | "swipe" | "result";
const STEPS: Step[] = ["welcome", "basics", "city", "swipe", "result"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [wardrobe, setWardrobe] = useState<StyleProfile["wardrobe"]>("both");
  const [lifestyle, setLifestyle] = useState<Occasion[]>(["casual"]);
  const [budget, setBudget] = useState<StyleProfile["budget"]>("mid");
  const [city, setCity] = useState<StyleProfile["city"]>();
  const [swipes, setSwipes] = useState<{ look: Look; value: number }[]>([]);
  const [weights, setWeights] = useState<Record<Style, number>>();
  const [avoid, setAvoid] = useState<ColorName[]>([]);

  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1]);
  const progress = STEPS.indexOf(step) / (STEPS.length - 1);

  const finish = async (dest: string) => {
    await saveProfile({
      completedOnboarding: true,
      wardrobe,
      lifestyle,
      budget,
      city,
      styleWeights: weights ?? normalise(weightsFromSwipes(swipes)),
      avoidColors: avoid,
    });
    router.replace(dest);
  };

  return (
    <div className="flex min-h-[calc(100dvh-40px)] flex-col">
      {step !== "welcome" && (
        <div className="mb-6 flex items-center gap-3">
          <button className="text-sm text-muted" onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>
            ← Back
          </button>
          <div className="h-1 flex-1 overflow-hidden bg-soft">
            <div className="h-full bg-ink transition-all dark:bg-accent-text" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      {step === "welcome" && (
        <div className="flex flex-1 flex-col">
          <Hero
            word="BgadAI"
            accent="Created for you."
            visuals={[
              { kind: "garment", sub: "coat", color: "camel" },
              { kind: "garment", sub: "trousers", color: "navy" },
            ]}
            left={
              <>
                <p className="display text-[20px]">Your closet, styled by AI</p>
                <p className="mt-1.5 max-w-[34ch] text-[13px] leading-snug text-muted">
                  Snap your clothes, tell us your style, and get outfits built from what you already own.
                </p>
              </>
            }
          />

          <SectionTitle className="mt-6" accent="made by you.">Styled by AI.</SectionTitle>

          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6">
            {[
              ["Digital closet", "Photos become a tidy, tagged wardrobe in seconds."],
              ["Daily outfits", "Weather-smart looks with a reason for each one."],
              ["Recreate looks", "Rebuild outfits you love from your own clothes."],
              ["Private by design", "Your photos stay on this device."],
            ].map(([t, d]) => (
              <li key={t}>
                <h3 className="display text-[17px]">{t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{d}</p>
              </li>
            ))}
          </ul>

          <div className="flex-1" />
          <Button className="mt-10 w-full" onClick={next}>
            Find my style · 2 min
          </Button>
        </div>
      )}

      {step === "basics" && (
        <div className="flex flex-1 flex-col">
          <h2 className="display text-[34px]">A little about you</h2>
          <Section title="Which clothes should we show you?">
            {(["womenswear", "menswear", "both"] as const).map((w) => (
              <Chip key={w} selected={wardrobe === w} onClick={() => setWardrobe(w)}>
                {w === "both" ? "Both / any" : w[0].toUpperCase() + w.slice(1)}
              </Chip>
            ))}
          </Section>
          <Section title="What do you dress for most? (pick any)">
            {OCCASIONS.map((o) => (
              <Chip
                key={o}
                selected={lifestyle.includes(o)}
                onClick={() => setLifestyle(lifestyle.includes(o) ? lifestyle.filter((x) => x !== o) : [...lifestyle, o])}
              >
                {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
              </Chip>
            ))}
          </Section>
          <Section title="Shopping budget for new pieces">
            {([["low", "€ Budget"], ["mid", "€€ Mid-range"], ["high", "€€€ Premium"]] as const).map(([b, l]) => (
              <Chip key={b} selected={budget === b} onClick={() => setBudget(b)}>
                {l}
              </Chip>
            ))}
          </Section>
          <div className="flex-1" />
          <Button className="mt-8 w-full" onClick={next} disabled={!lifestyle.length}>
            Continue
          </Button>
        </div>
      )}

      {step === "city" && <CityStep value={city} onChange={setCity} onNext={next} />}

      {step === "swipe" && (
        <SwipeDeck
          looks={looksFor(wardrobe)}
          onDone={(s) => {
            setSwipes(s);
            setWeights(weightsFromSwipes(s));
            next();
          }}
        />
      )}

      {step === "result" && weights && (
        <div className="flex flex-1 flex-col">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">Your style mix</p>
          <h2 className="display mt-1 text-[40px]">
            {topStyles(weights, 1)[0] ? STYLE_INFO[topStyles(weights, 1)[0].style].label : "Eclectic"}
          </h2>
          <div className="mt-5 space-y-3 rounded-card bg-ink p-5 text-bg dark:border dark:border-line dark:bg-card dark:text-ink">
            {topStyles(weights, 3).map(({ style, pct }) => (
              <div key={style}>
                <div className="flex justify-between text-sm">
                  <span>
                    {STYLE_INFO[style].emoji} {STYLE_INFO[style].label}
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full bg-[#e9c53e] dark:bg-accent-text" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs opacity-70">{STYLE_INFO[style].blurb}</p>
              </div>
            ))}
          </div>

          <details className="mt-5 rounded-tile border border-line bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Fine-tune my mix</summary>
            <div className="mt-4 space-y-3">
              {STYLES.map((s) => (
                <label key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0">{STYLE_INFO[s].label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(weights[s] * 100)}
                    onChange={(e) => setWeights(normalise({ ...weights, [s]: +e.target.value / 100 + 0.0001 }))}
                    className="flex-1 accent-[var(--accent)]"
                  />
                </label>
              ))}
            </div>
          </details>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Colours you never wear (optional)</p>
            <ColorPicker value={avoid} onChange={setAvoid} max={6} />
          </div>

          <div className="flex-1" />
          <Button className="mt-8 w-full" onClick={() => finish("/closet/add?quick=1")}>
            Add my first 5 pieces
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => finish("/")}>
            I&apos;ll do it later
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-2.5 text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function CityStep({ value, onChange, onNext }: { value?: StyleProfile["city"]; onChange: (c?: StyleProfile["city"]) => void; onNext: () => void }) {
  const [q, setQ] = useState(value?.name ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>();

  const search = async () => {
    setLoading(true);
    setErr(undefined);
    try {
      setResults(await searchCity(q));
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="display text-[34px]">Where are you?</h2>
      <p className="mt-1 text-sm text-muted">We use the local forecast to pick weather-proof outfits.</p>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="City, e.g. Paris"
          className="h-12 flex-1 rounded-btn border border-edge bg-card px-4 outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={q.trim().length < 2}>
          {loading ? <Spinner /> : "Search"}
        </Button>
      </form>
      {err && <p className="mt-2 text-sm text-bad">{err}</p>}
      <ul className="mt-3 space-y-2">
        {results.map((r) => {
          const selected = value?.latitude === r.latitude && value?.longitude === r.longitude;
          return (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                onClick={() => onChange({ name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country })}
                className={`w-full rounded-tile border px-4 py-3 text-left ${selected ? "border-ink bg-card" : "border-line bg-card/60"}`}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-sm text-muted"> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                {selected && <span className="float-right">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex-1" />
      <Button className="mt-8 w-full" onClick={onNext}>
        {value ? `Use ${value.name}` : "Skip for now"}
      </Button>
    </div>
  );
}

function SwipeDeck({ looks, onDone }: { looks: Look[]; onDone: (s: { look: Look; value: number }[]) => void }) {
  const deck = useMemo(() => looks.slice(0, 18), [looks]);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<{ look: Look; value: number }[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<number>(0);
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const vote = (value: number) => {
    const look = deck[idx];
    const nextRes = [...result, { look, value }];
    setLeaving(value > 0 ? 1 : -1);
    setTimeout(() => {
      setLeaving(0);
      setDx(0);
      setResult(nextRes);
      if (idx + 1 >= deck.length) onDone(nextRes);
      else setIdx(idx + 1);
    }, 180);
  };

  const look = deck[idx];
  if (!look) return <Spinner />;
  const tx = leaving ? leaving * 500 : dx;

  return (
    <div className="flex flex-1 flex-col">
      <h2 className="display text-[34px]">Style Shuffle</h2>
      <p className="mt-1 text-sm text-muted">
        Would you wear it? Swipe right for yes, left for no. <span className="tabular-nums">{idx + 1}/{deck.length}</span>
      </p>

      <div className="relative mt-6 h-[400px] select-none">
        {deck[idx + 1] && <LookCard look={deck[idx + 1]} className="scale-[0.95] opacity-60" />}
        <div
          className="absolute inset-0 touch-none"
          style={{ transform: `translateX(${tx}px) rotate(${tx / 25}deg)`, transition: dragging ? "none" : "transform .18s ease-out" }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            setDragging(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
          onPointerUp={() => {
            start.current = null;
            setDragging(false);
            if (dx > 90) vote(1);
            else if (dx < -90) vote(-0.6);
            else setDx(0);
          }}
        >
          <LookCard look={look} />
          {dx > 30 && <Stamp text="YES" className="left-5 rotate-[-12deg] border-good text-good" />}
          {dx < -30 && <Stamp text="NOPE" className="right-5 rotate-[12deg] border-bad text-bad" />}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-5">
        <RoundBtn label="Not for me" onClick={() => vote(-0.6)}>✕</RoundBtn>
        <RoundBtn label="Love it" onClick={() => vote(2)} big>★</RoundBtn>
        <RoundBtn label="I'd wear it" onClick={() => vote(1)}>♥</RoundBtn>
      </div>
      <button className="mt-4 text-center text-sm text-muted underline" onClick={() => onDone(result)} disabled={result.length < 4}>
        {result.length >= 4 ? "That's enough, show my result" : " "}
      </button>
    </div>
  );
}

function LookCard({ look, className = "" }: { look: Look; className?: string }) {
  return (
    <div className={`absolute inset-0 flex flex-col rounded-card border border-line bg-card p-5 shadow-sm ${className}`}>
      <div className="cutout-bg grid flex-1 grid-cols-2 place-items-center gap-1 rounded-tile p-3">
        {look.pieces.map((p, i) => (
          <Garment key={i} sub={p.sub} color={p.color} className={look.pieces.length === 3 && i === 0 ? "col-span-2 h-28 w-28" : "h-24 w-24"} />
        ))}
      </div>
      <p className="mt-4 text-[17px] leading-snug font-medium">{look.title}</p>
    </div>
  );
}

function Stamp({ text, className }: { text: string; className: string }) {
  return <span className={`absolute top-6 rounded-lg border-4 px-3 py-1 text-2xl font-black ${className}`}>{text}</span>;
}

function RoundBtn({ children, onClick, label, big }: { children: React.ReactNode; onClick: () => void; label: string; big?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid place-items-center rounded-btn border border-edge bg-card text-xl shadow-sm active:scale-95 ${big ? "h-16 w-16 text-2xl text-[#d9a400]" : "h-14 w-14"}`}
    >
      {children}
    </button>
  );
}
