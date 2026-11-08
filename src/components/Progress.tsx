"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useItems } from "@/hooks/data";
import { db, today } from "@/lib/db";
import { shareImage, statsCard } from "@/lib/share";
import { badges, declutterCandidates, loggingStreak, styleLabel, weeklyChallenges, wrapped } from "@/lib/stats";
import { ItemImage } from "./ItemImage";
import { Button, Card, Swatch } from "./ui";

/** Logging streak, weekly challenges and badges. */
export function Habits() {
  const items = useItems();
  const logs = useLiveQuery(() => db.wearLogs.toArray(), []);
  const outfits = useLiveQuery(() => db.outfits.toArray(), []);
  const trips = useLiveQuery(() => db.trips.count(), []);
  if (!items || !logs || !outfits || trips === undefined) return null;
  const day = today();
  const streak = loggingStreak(logs, day);
  const challenges = weeklyChallenges(items, logs, day);
  const list = badges(items, logs, outfits, trips, day);
  const thirty = items
    .filter((i) => i.wearCount > 0 && i.status !== "archived")
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, 3);

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="display text-[20px]">This week</h2>
        <span className="label rounded-btn border border-edge px-2.5 py-1">🔥 {streak}-day streak</span>
      </div>
      <ul className="space-y-3">
        {challenges.map((c) => {
          const done = c.progress >= c.goal;
          return (
            <li key={c.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{done ? "✓ " : ""}{c.title}</span>
                <span className="tabular-nums text-muted">{Math.min(c.progress, c.goal)}/{c.goal}</span>
              </div>
              <div className="mt-1 h-1 bg-soft">
                <div className={`h-full ${done ? "bg-good" : "bg-ink dark:bg-accent-text"}`} style={{ width: `${Math.min(1, c.progress / c.goal) * 100}%` }} />
              </div>
              <p className="mt-1 text-[12px] text-muted">{c.detail}</p>
            </li>
          );
        })}
      </ul>

      {thirty.length > 0 && (
        <div>
          <p className="label mb-2 text-muted">#30wears — the sustainable goal per piece</p>
          <ul className="space-y-2">
            {thirty.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <ItemImage blob={i.thumb} alt="" plain className="h-10 w-10 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="truncate">{i.name}</span>
                    <span className="tabular-nums text-muted">{Math.min(i.wearCount, 30)}/30</span>
                  </div>
                  <div className="mt-1 h-1 bg-soft">
                    <div className="h-full bg-good" style={{ width: `${Math.min(1, i.wearCount / 30) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="label mb-2 text-muted">Badges · {list.filter((b) => b.earned).length}/{list.length}</p>
        <ul className="grid grid-cols-5 gap-2">
          {list.map((b) => (
            <li key={b.id} title={`${b.title} — ${b.detail}`} className={`flex flex-col items-center text-center ${b.earned ? "" : "opacity-30 grayscale"}`}>
              <span className="grid h-11 w-11 place-items-center rounded-btn border border-edge text-xl">{b.emoji}</span>
              <span className="mt-1 text-[9.5px] leading-tight">{b.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** A shareable "Style Wrapped" recap of what you actually wore this year. */
export function WrappedCard() {
  const items = useItems();
  const logs = useLiveQuery(() => db.wearLogs.toArray(), []);
  const [msg, setMsg] = useState<string>();
  const year = new Date().getFullYear();
  const w = useMemo(() => (items && logs ? wrapped(items, logs, `${year}-01-01`) : undefined), [items, logs, year]);
  if (!w || !logs?.length) return null;

  const lines: [string, string][] = [
    [String(w.days), "days dressed & logged"],
    [w.topItem?.name ?? "—", "most-worn piece"],
    [w.topColor ?? "—", "signature colour"],
    [styleLabel(w.topStyle), "your style, in practice"],
    [`${w.usedPct}%`, "of your closet worn"],
  ];

  return (
    <section className="relative overflow-hidden rounded-card bg-ink p-5 text-bg dark:border dark:border-line dark:bg-card dark:text-ink">
      <p className="label opacity-60">Style Wrapped · {year}</p>
      <p className="display mt-2 text-[34px]">Your year in outfits</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        {lines.map(([v, l]) => (
          <div key={l}>
            <p className="display flex items-start gap-2 text-[17px] leading-[1.05] break-words">
              {l === "signature colour" && w.topColor && <Swatch color={w.topColor} size={14} />}
              <span className="min-w-0">{v}</span>
            </p>
            <p className="label mt-1 opacity-60">{l}</p>
          </div>
        ))}
        {w.cpwChampion && (
          <div>
            <p className="display text-[22px]">{w.cpwChampion.cpw.toFixed(2)}</p>
            <p className="label mt-1 opacity-60">best cost per wear · {w.cpwChampion.item.name}</p>
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-5 border-current text-current"
        onClick={async () => {
          const blob = await statsCard(`My ${year} in outfits`, lines, w.topItem ? [{ blob: w.topItem.thumb }] : []);
          const r = await shareImage(blob, `style-wrapped-${year}.png`, `My ${year} in outfits`);
          if (r === "downloaded") setMsg("Image saved");
        }}
      >
        Share my Wrapped
      </Button>
      {msg && <p className="mt-2 text-xs opacity-70">{msg}</p>}
    </section>
  );
}

/** Pieces you haven't worn in a while — style them, archive them, or pass them on. */
export function Declutter() {
  const items = useItems();
  const [now] = useState(() => Date.now());
  if (!items) return null;
  const list = declutterCandidates(items, now, 90).slice(0, 6);
  if (!list.length) return null;
  return (
    <Card className="space-y-3">
      <h2 className="display text-[20px]">Time to decide?</h2>
      <p className="text-[13px] text-muted">Not worn in 3+ months. Give each one a last chance, or let it go — resale and donation keep clothes in use.</p>
      <ul className="space-y-2">
        {list.map(({ item, idleDays }) => (
          <li key={item.id} className="flex items-center gap-3">
            <ItemImage blob={item.thumb} alt="" plain className="h-12 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{item.name}</p>
              <p className="label text-muted">{idleDays} days idle</p>
              <div className="mt-1 flex gap-3 text-[11px] font-semibold uppercase tracking-wide">
                <Link href={`/?anchor=${item.id}`} className="text-ink dark:text-accent-text">Style it</Link>
                <a href="https://www.vinted.com/items/new" target="_blank" rel="noopener noreferrer" className="text-muted">Sell</a>
                <button className="uppercase text-muted" onClick={() => db.items.update(item.id, { status: "archived" })}>Archive</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
