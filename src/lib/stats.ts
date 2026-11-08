/** Habit, challenge, badge, "Wrapped" and declutter logic — pure functions over local data. */
import { STYLE_INFO, type ColorName, type Style } from "./taxonomy";
import type { Item, Outfit, WearLog } from "./types";

const DAY = 86_400_000;

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

/** Consecutive days with a logged outfit, ending today (or yesterday if today isn't logged yet). */
export function loggingStreak(logs: WearLog[], today: string): number {
  const days = new Set(logs.map((l) => l.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Monday-based start of the week containing `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const offset = (date.getDay() + 6) % 7;
  return addDays(day, -offset);
}

/**
 * Pieces worn this week that hadn't been worn in the 30 days before it.
 * With `items`, only pieces owned for that whole period count (a brand-new closet isn't "forgotten").
 */
export function rediscovered(logs: WearLog[], today: string, items?: Item[]): Set<string> {
  const start = weekStart(today);
  const before = addDays(start, -30);
  const recent = new Set<string>();
  const thisWeek = new Set<string>();
  for (const l of logs) {
    if (l.date >= start && l.date <= today) l.itemIds.forEach((i) => thisWeek.add(i));
    else if (l.date >= before && l.date < start) l.itemIds.forEach((i) => recent.add(i));
  }
  const [y, m, d] = before.split("-").map(Number);
  const ownedSince = new Date(y, m - 1, d).getTime();
  const old = items ? new Set(items.filter((i) => i.createdAt <= ownedSince).map((i) => i.id)) : undefined;
  return new Set([...thisWeek].filter((i) => !recent.has(i) && (!old || old.has(i))));
}

export type Challenge = { id: string; title: string; detail: string; progress: number; goal: number };

export function weeklyChallenges(items: Item[], logs: WearLog[], today: string): Challenge[] {
  const start = weekStart(today);
  const weekLogs = logs.filter((l) => l.date >= start && l.date <= today);
  const daysLogged = new Set(weekLogs.map((l) => l.date)).size;
  const distinctPieces = new Set(weekLogs.flatMap((l) => l.itemIds)).size;
  return [
    { id: "rediscover", title: "Rediscover 3 pieces", detail: "Wear things you haven't touched in a month.", progress: rediscovered(logs, today, items).size, goal: 3 },
    { id: "log5", title: "Log 5 outfits", detail: "Tap “Wear today” on 5 days this week.", progress: daysLogged, goal: 5 },
    { id: "variety", title: "Wear 10 different pieces", detail: "Rotate your closet instead of repeating favourites.", progress: distinctPieces, goal: Math.min(10, Math.max(items.length, 1)) },
  ];
}

export type Badge = { id: string; emoji: string; title: string; detail: string; earned: boolean };

export function badges(items: Item[], logs: WearLog[], outfits: Outfit[], tripCount: number, today: string): Badge[] {
  const streak = loggingStreak(logs, today);
  const maxWears = Math.max(0, ...items.map((i) => i.wearCount));
  const totalRediscovered = rediscovered(logs, today, items).size;
  return [
    { id: "first", emoji: "🧺", title: "First piece", detail: "Add an item to your closet", earned: items.length >= 1 },
    { id: "closet10", emoji: "👕", title: "Closet of 10", detail: "Catalogue 10 pieces", earned: items.length >= 10 },
    { id: "closet25", emoji: "🗂️", title: "Curator", detail: "Catalogue 25 pieces", earned: items.length >= 25 },
    { id: "saved", emoji: "💾", title: "Stylist", detail: "Save an outfit", earned: outfits.length >= 1 },
    { id: "logged", emoji: "📅", title: "Dressed & logged", detail: "Log your first outfit", earned: logs.length >= 1 },
    { id: "streak3", emoji: "🔥", title: "On a roll", detail: "3-day logging streak", earned: streak >= 3 },
    { id: "streak7", emoji: "🏆", title: "Full week", detail: "7-day logging streak", earned: streak >= 7 },
    { id: "rediscover", emoji: "🔁", title: "Rediscovery", detail: "Wear 3 forgotten pieces in a week", earned: totalRediscovered >= 3 },
    { id: "thirty", emoji: "🌱", title: "#30wears", detail: "Wear one piece 30 times", earned: maxWears >= 30 },
    { id: "trip", emoji: "🧳", title: "Packed light", detail: "Plan a trip", earned: tripCount >= 1 },
  ];
}

export type Wrapped = {
  days: number;
  outfits: number;
  topItem?: Item;
  topColor?: ColorName;
  topStyle?: Style;
  usedPct: number;
  cpwChampion?: { item: Item; cpw: number };
  repeatRate: number;
};

/** A "Spotify Wrapped"-style recap of what you actually wore since `from`. */
export function wrapped(items: Item[], logs: WearLog[], from: string): Wrapped {
  const period = logs.filter((l) => l.date >= from);
  const counts = new Map<string, number>();
  for (const l of period) for (const id of l.itemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const byId = new Map(items.map((i) => [i.id, i]));
  const worn = [...counts.entries()].map(([id, n]) => ({ item: byId.get(id), n })).filter((x): x is { item: Item; n: number } => !!x.item);
  worn.sort((a, b) => b.n - a.n);
  const tally = <K extends string>(get: (i: Item) => K[]) => {
    const m = new Map<K, number>();
    for (const { item, n } of worn) for (const k of get(item)) m.set(k, (m.get(k) ?? 0) + n);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const active = items.filter((i) => i.status !== "archived");
  const priced = active.filter((i) => i.price && i.wearCount > 0).map((i) => ({ item: i, cpw: i.price! / i.wearCount }));
  priced.sort((a, b) => a.cpw - b.cpw);
  const keys = period.map((l) => [...l.itemIds].sort().join("|"));
  return {
    days: new Set(period.map((l) => l.date)).size,
    outfits: period.length,
    topItem: worn[0]?.item,
    topColor: tally((i) => i.colors.slice(0, 1)),
    topStyle: tally((i) => i.styles),
    usedPct: active.length ? Math.round((worn.length / active.length) * 100) : 0,
    cpwChampion: priced[0],
    repeatRate: keys.length ? Math.round((1 - new Set(keys).size / keys.length) * 100) : 0,
  };
}

export function styleLabel(s?: Style) {
  return s ? STYLE_INFO[s].label : "—";
}

/** Pieces worth reconsidering: unworn for `days`+ (or never worn and owned that long). */
export function declutterCandidates(items: Item[], now: number, days = 90): { item: Item; idleDays: number }[] {
  return items
    .filter((i) => i.status === "active" && !i.sample)
    .map((i) => ({ item: i, idleDays: Math.floor((now - (i.lastWornAt ?? i.createdAt)) / DAY) }))
    .filter((x) => x.idleDays >= days)
    .sort((a, b) => b.idleDays - a.idleDays);
}
