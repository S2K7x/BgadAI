"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ItemImage } from "@/components/ItemImage";
import { OutfitBoard } from "@/components/OutfitBoard";
import { Button, Card, Chip, Empty, PageHeader, Sheet, Spinner } from "@/components/ui";
import { toEngine, useItems, useProfile } from "@/hooks/data";
import { db, logWorn, today as todayKey, uid } from "@/lib/db";
import { generateOutfits, planTrip, type TripDayInput } from "@/lib/outfitEngine";
import { addDays } from "@/lib/stats";
import { CATEGORIES, CATEGORY_LABELS, OCCASION_INFO, type Occasion } from "@/lib/taxonomy";
import type { Item, Trip, WearLog } from "@/lib/types";
import { dayTemp, fetchForecastRange, searchCity, type DayForecast, type GeoResult } from "@/lib/weather";

const noop = () => () => {};
const randomSeed = () => Math.floor(Math.random() * 1e9);

const label = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};

export default function PlanPage() {
  const items = useItems();
  const profile = useProfile();
  const plans = useLiveQuery(() => db.plans.toArray(), []);
  const logs = useLiveQuery(() => db.wearLogs.toArray(), []);
  const trips = useLiveQuery(() => db.trips.orderBy("createdAt").reverse().toArray(), []);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [day, setDay] = useState<string>();
  const [newTrip, setNewTrip] = useState(false);
  const [openTrip, setOpenTrip] = useState<string>();
  // Today's date only exists on the client; the prerendered shell gets "".
  const start = useSyncExternalStore(noop, todayKey, () => "");
  const week = useMemo(() => (start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : []), [start]);

  const city = profile?.city;
  useEffect(() => {
    if (!city || !week.length) return;
    let alive = true;
    fetchForecastRange(city.latitude, city.longitude, week[0], week[6])
      .then((f) => alive && setForecast(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [city, week]);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  if (!items || !plans || !logs || !trips || !profile || !start) return <Spinner />;
  const planFor = (d: string) => plans.find((p) => p.id === d);
  const wornOn = (d: string) => logs.find((l) => l.date === d);

  return (
    <div className="space-y-8">
      <PageHeader title="Plan" accent="Your week, sorted." subtitle="Plan outfits ahead with the forecast, and pack light for trips." />

      <section>
        <h2 className="label mb-3 text-muted">This week</h2>
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
          {week.map((d) => {
            const plan = planFor(d);
            const worn = wornOn(d);
            const f = forecast.find((x) => x.date === d);
            const ids = worn?.itemIds ?? plan?.itemIds ?? [];
            const thumbs = ids.map((id) => byId.get(id)).filter((x): x is Item => !!x).slice(0, 4);
            return (
              <button key={d} onClick={() => setDay(d)} className="w-[124px] shrink-0 rounded-card border border-line bg-card p-2.5 text-left transition-colors duration-200 hover:border-edge lg:w-auto">
                <p className="label text-muted">{d === start ? "Today" : label(d, { weekday: "short" })}</p>
                <p className="display text-[22px]">{label(d, { day: "numeric" })}</p>
                <p className="mt-0.5 h-4 text-[11px] text-muted">{f ? `${Math.round(f.tempMinC)}–${Math.round(f.tempMaxC)}° · ☔${f.precipProb}%` : ""}</p>
                <div className="mt-2 grid h-[104px] grid-cols-2 gap-1">
                  {thumbs.length ? (
                    thumbs.map((t) => <ItemImage key={t.id} blob={t.thumb} alt={t.name} plain className="h-[50px] w-full" />)
                  ) : (
                    <span className="label col-span-2 grid place-items-center border border-dashed border-edge text-muted">+ Plan</span>
                  )}
                </div>
                <p className="label mt-1.5 h-3 text-good">{worn ? "✓ Worn" : plan ? "Planned" : ""}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0">
      <History logs={logs} byId={byId} today={start} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-[24px]">Trips</h2>
          <Button size="sm" onClick={() => setNewTrip(true)} disabled={items.length < 3}>
            + New trip
          </Button>
        </div>
        {trips.length === 0 ? (
          <Empty emoji="🧳" title="Pack light">
            Pick a destination and dates. We&apos;ll plan an outfit for every day and build the smallest suitcase that covers them all.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {trips.map((t) => (
              <li key={t.id}>
                <button onClick={() => setOpenTrip(t.id)} className="w-full text-left">
                  <Card className="flex items-center gap-3">
                    <span className="text-3xl">🧳</span>
                    <div className="min-w-0 flex-1">
                      <p className="display truncate text-[20px]">{t.city.name}</p>
                      <p className="text-[12px] text-muted">
                        {label(t.start, { day: "numeric", month: "short" })} · {t.days.length} days · {t.packing.length} pieces → {t.days.length} outfits
                      </p>
                    </div>
                    <span className="label text-muted">{t.packed.length}/{t.packing.length} packed</span>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      </div>

      <Sheet open={!!day} onClose={() => setDay(undefined)} title={day ? label(day, { weekday: "long", day: "numeric", month: "long" }) : ""}>
        {day && <DayPlanner day={day} items={items} forecast={forecast.find((f) => f.date === day)} onDone={() => setDay(undefined)} />}
      </Sheet>
      <Sheet open={newTrip} onClose={() => setNewTrip(false)} title="New trip">
        {newTrip && (
          <TripForm
            items={items}
            onCreated={(id) => {
              setNewTrip(false);
              setOpenTrip(id);
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!openTrip} onClose={() => setOpenTrip(undefined)} title={trips.find((t) => t.id === openTrip)?.city.name ?? ""}>
        {openTrip && trips.find((t) => t.id === openTrip) && (
          <TripView trip={trips.find((t) => t.id === openTrip)!} byId={byId} onDeleted={() => setOpenTrip(undefined)} />
        )}
      </Sheet>
    </div>
  );
}

function DayPlanner({ day, items, forecast, onDone }: { day: string; items: Item[]; forecast?: DayForecast; onDone: () => void }) {
  const profile = useProfile();
  const saved = useLiveQuery(() => db.outfits.orderBy("createdAt").reverse().limit(12).toArray(), []);
  const existing = useLiveQuery(() => db.plans.get(day), [day]);
  const [occasion, setOccasion] = useState<Occasion>(profile?.lifestyle[0] ?? "casual");
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const suggestions = useMemo(
    () =>
      generateOutfits(toEngine(items), {
        occasion,
        tempC: forecast ? dayTemp(forecast) : undefined,
        precipProb: forecast?.precipProb,
        styleWeights: profile?.styleWeights,
        avoidColors: profile?.avoidColors,
        seed: Number(day.replaceAll("-", "")),
      }, 3).candidates,
    [items, occasion, forecast, profile, day],
  );
  const choose = async (itemIds: string[], outfitId?: string) => {
    await db.plans.put({ id: day, itemIds, occasion, outfitId });
    onDone();
  };
  const toItems = (ids: string[]) => ids.map((id) => byId.get(id)).filter((x): x is Item => !!x);

  return (
    <div className="space-y-5 pb-4">
      {forecast && (
        <p className="text-sm text-muted">
          Forecast {Math.round(forecast.tempMinC)}–{Math.round(forecast.tempMaxC)}°C · ☔ {forecast.precipProb}%
        </p>
      )}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {(["casual", "work", "date", "party", "formal", "sport", "travel"] as Occasion[]).map((o) => (
          <Chip key={o} selected={occasion === o} onClick={() => setOccasion(o)}>
            {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
          </Chip>
        ))}
      </div>
      {existing && (
        <Card>
          <p className="label mb-2 text-muted">Planned</p>
          <OutfitBoard items={toItems(existing.itemIds)} compact />
          <Button size="sm" variant="ghost" className="mt-2" onClick={async () => { await db.plans.delete(day); onDone(); }}>
            Clear plan
          </Button>
        </Card>
      )}
      <div className="space-y-3">
        <p className="label text-muted">Suggestions</p>
        {suggestions.length === 0 && <p className="text-sm text-muted">Add a few more pieces to get suggestions.</p>}
        {suggestions.map((c, i) => (
          <Card key={i}>
            <OutfitBoard items={toItems(c.items.map((x) => x.id))} compact />
            <p className="mt-2 text-[13px] text-muted">{c.explanation}</p>
            <Button size="sm" className="mt-2" onClick={() => choose(c.items.map((x) => x.id))}>Plan this</Button>
          </Card>
        ))}
      </div>
      {!!saved?.length && (
        <div>
          <p className="label mb-2 text-muted">Or a saved outfit</p>
          <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5">
            {saved.map((o) => (
              <button key={o.id} onClick={() => choose(o.pieces.map((p) => p.itemId), o.id)} className="w-[150px] shrink-0 text-left">
                <OutfitBoard items={toItems(o.pieces.map((p) => p.itemId))} compact />
                <p className="mt-1 truncate text-[12px]">{o.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TRIP_STYLES: { id: string; label: string; pattern: (i: number) => Occasion }[] = [
  { id: "holiday", label: "Holiday", pattern: (i) => (i % 3 === 2 ? "date" : "casual") },
  { id: "business", label: "Business", pattern: (i) => (i % 3 === 2 ? "date" : "work") },
  { id: "active", label: "Active", pattern: (i) => (i % 2 ? "sport" : "casual") },
];

function TripForm({ items, onCreated }: { items: Item[]; onCreated: (id: string) => void }) {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [city, setCity] = useState<Trip["city"]>();
  const [start, setStart] = useState(addDays(todayKey(), 7));
  const [nights, setNights] = useState(4);
  const [style, setStyle] = useState("holiday");
  const [climate, setClimate] = useState<number>(16);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const create = async () => {
    if (!city) return;
    setBusy(true);
    setErr(undefined);
    try {
      const dates = Array.from({ length: nights + 1 }, (_, i) => addDays(start, i));
      let fc: DayForecast[] = [];
      try {
        fc = await fetchForecastRange(city.latitude, city.longitude, dates[0], dates[dates.length - 1]);
      } catch {}
      const pattern = TRIP_STYLES.find((s) => s.id === style)!.pattern;
      const days: TripDayInput[] = dates.map((date, i) => {
        const f = fc.find((x) => x.date === date);
        return { date, occasion: pattern(i), tempC: f ? dayTemp(f) : climate, precipProb: f?.precipProb };
      });
      const plan = planTrip(toEngine(items), days, { styleWeights: profile?.styleWeights, avoidColors: profile?.avoidColors });
      const id = uid();
      await db.trips.add({ id, createdAt: Date.now(), city, start, nights, days: plan.days, packing: plan.packing, packed: [] });
      onCreated(id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-4 text-sm">
      <div>
        <p className="label mb-2 text-muted">Destination {city && <span className="text-ink">· {city.name}</span>}</p>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setResults(await searchCity(q).catch(() => [])); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City" className="h-10 flex-1 rounded-btn border border-edge bg-bg px-3" />
          <Button size="sm" variant="secondary" type="submit">Search</Button>
        </form>
        {results.length > 0 && (
          <ul className="mt-2 space-y-1">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button className="w-full rounded-btn px-3 py-2 text-left hover:bg-soft" onClick={() => { setCity({ name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country }); setResults([]); }}>
                  {r.name} <span className="text-muted">· {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label mb-1 block text-muted">Leaving</span>
          <input type="date" value={start} min={todayKey()} onChange={(e) => setStart(e.target.value)} className="h-10 w-full rounded-btn border border-edge bg-bg px-3" />
        </label>
        <label>
          <span className="label mb-1 block text-muted">Nights</span>
          <input type="number" min={1} max={14} value={nights} onChange={(e) => setNights(Math.max(1, Math.min(14, +e.target.value || 1)))} className="h-10 w-full rounded-btn border border-edge bg-bg px-3" />
        </label>
      </div>
      <div>
        <p className="label mb-2 text-muted">Kind of trip</p>
        <div className="flex gap-2">
          {TRIP_STYLES.map((s) => (
            <Chip key={s.id} selected={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2 text-muted">Expected weather (used beyond the 16-day forecast)</p>
        <div className="flex gap-2">
          {([[26, "Hot"], [16, "Mild"], [6, "Cold"]] as const).map(([t, l]) => (
            <Chip key={l} selected={climate === t} onClick={() => setClimate(t)}>{l}</Chip>
          ))}
        </div>
      </div>
      {err && <p className="text-bad">{err}</p>}
      <Button className="w-full" onClick={create} disabled={!city || busy}>
        {busy ? <Spinner /> : "Plan outfits & packing list"}
      </Button>
    </div>
  );
}

function TripView({ trip, byId, onDeleted }: { trip: Trip; byId: Map<string, Item>; onDeleted: () => void }) {
  const profile = useProfile();
  const [added, setAdded] = useState(false);
  const regenerate = async (idx: number) => {
    const d = trip.days[idx];
    const others = new Set(trip.days.filter((_, i) => i !== idx).flatMap((x) => x.itemIds));
    const current = [...d.itemIds].sort().join("|");
    const { candidates } = generateOutfits(toEngine([...byId.values()]), {
      occasion: d.occasion,
      tempC: d.tempC,
      precipProb: d.precipProb,
      styleWeights: profile?.styleWeights,
      avoidColors: profile?.avoidColors,
      seed: randomSeed(),
    }, 8);
    // Prefer a different look that mostly reuses what's already packed.
    const pick = candidates
      .filter((c) => c.items.map((i) => i.id).sort().join("|") !== current)
      .map((c) => ({ c, v: c.score.total + 0.1 * (c.items.filter((i) => others.has(i.id)).length / c.items.length) }))
      .sort((a, b) => b.v - a.v)[0]?.c;
    if (!pick) return;
    const days = trip.days.map((x, i) => (i === idx ? { ...x, itemIds: pick.items.map((it) => it.id) } : x));
    const packing = [...new Set(days.flatMap((x) => x.itemIds))];
    await db.trips.update(trip.id, { days, packing, packed: trip.packed.filter((p) => packing.includes(p)) });
  };
  const addToPlanner = async () => {
    await db.plans.bulkPut(trip.days.map((d) => ({ id: d.date, itemIds: d.itemIds, occasion: d.occasion })));
    setAdded(true);
  };
  const toggle = (id: string) =>
    db.trips.update(trip.id, { packed: trip.packed.includes(id) ? trip.packed.filter((x) => x !== id) : [...trip.packed, id] });
  const packItems = trip.packing.map((id) => byId.get(id)).filter((x): x is Item => !!x);
  return (
    <div className="space-y-6 pb-4">
      <p className="text-sm text-muted">
        {trip.packing.length} pieces make {trip.days.length} outfits · {trip.packed.length}/{trip.packing.length} packed
      </p>
      <section>
        <h3 className="display mb-2 text-[20px]">Packing list</h3>
        {CATEGORIES.map((c) => {
          const list = packItems.filter((i) => i.category === c);
          if (!list.length) return null;
          return (
            <div key={c} className="mb-3">
              <p className="label mb-1 text-muted">{CATEGORY_LABELS[c]}</p>
              <ul className="space-y-1.5">
                {list.map((i) => (
                  <li key={i.id}>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={trip.packed.includes(i.id)} onChange={() => toggle(i.id)} className="h-5 w-5 accent-[var(--ink)]" />
                      <ItemImage blob={i.thumb} alt="" plain className="h-10 w-10" />
                      <span className={`text-sm ${trip.packed.includes(i.id) ? "text-muted line-through" : ""}`}>{i.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
      <section className="space-y-3">
        <h3 className="display text-[20px]">Day by day</h3>
        <Button size="sm" variant="secondary" onClick={addToPlanner} disabled={added}>
          {added ? "✓ Added to your planner" : "Add these days to my planner"}
        </Button>
        {trip.days.map((d, idx) => (
          <Card key={d.date}>
            <div className="mb-2 flex items-center justify-between">
              <p className="label text-muted">
                {label(d.date, { weekday: "short", day: "numeric", month: "short" })} · {OCCASION_INFO[d.occasion].label}
                {d.tempC !== undefined && ` · ~${Math.round(d.tempC)}°C`}
              </p>
              <button className="label text-muted" onClick={() => regenerate(idx)} aria-label={`Another outfit for ${d.date}`}>
                ↻ Another
              </button>
            </div>
            <OutfitBoard items={d.itemIds.map((id) => byId.get(id)).filter((x): x is Item => !!x)} compact />
          </Card>
        ))}
      </section>
      <Button variant="danger" size="sm" className="w-full" onClick={async () => { if (confirm("Delete this trip?")) { await db.trips.delete(trip.id); onDeleted(); } }}>
        Delete trip
      </Button>
    </div>
  );
}

/** Month view of what you wore; tap a day to see it and wear it again. */
function History({ logs, byId, today }: { logs: WearLog[]; byId: Map<string, Item>; today: string }) {
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState<string>();
  const [y, m] = today.split("-").map(Number);
  const first = new Date(y, m - 1 + offset, 1);
  const monthKey = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const byDate = new Map<string, WearLog>();
  for (const l of logs) if (l.date.startsWith(monthKey)) byDate.set(l.date, l);
  const open = openDay ? byDate.get(openDay) : undefined;
  const openItems = open ? open.itemIds.map((id) => byId.get(id)).filter((x): x is Item => !!x) : [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display text-[24px]">Worn</h2>
        <div className="flex items-center gap-2">
          <button className="label h-8 w-8 rounded-btn border border-edge" onClick={() => setOffset(offset - 1)} aria-label="Previous month">‹</button>
          <span className="label w-24 text-center">{first.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <button className="label h-8 w-8 rounded-btn border border-edge disabled:opacity-30" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="label text-muted">{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
          const log = byDate.get(date);
          const thumb = log ? byId.get(log.itemIds.find((id) => ["top", "onepiece"].includes(byId.get(id)?.category ?? "")) ?? log.itemIds[0]) : undefined;
          return (
            <button
              key={date}
              disabled={!log}
              onClick={() => setOpenDay(date)}
              aria-label={log ? `Outfit worn on ${date}` : undefined}
              className={`relative aspect-square overflow-hidden rounded-tile border text-[11px] ${date === today ? "border-ink" : "border-line"} ${log ? "" : "text-muted"}`}
            >
              {thumb && <ItemImage blob={thumb.thumb} alt="" plain className="absolute inset-0 h-full w-full" />}
              <span className={`absolute top-0.5 left-1 ${thumb ? "rounded-sm bg-card/80 px-0.5" : ""}`}>{i + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">{byDate.size} days logged this month</p>
      <Sheet open={!!open} onClose={() => setOpenDay(undefined)} title={openDay ? label(openDay, { weekday: "long", day: "numeric", month: "long" }) : ""}>
        {open && (
          <div className="space-y-3 pb-4">
            <OutfitBoard items={openItems} compact />
            <Button
              onClick={async () => {
                await logWorn(open.itemIds, open.outfitId);
                setOpenDay(undefined);
              }}
            >
              Wear it again today
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
