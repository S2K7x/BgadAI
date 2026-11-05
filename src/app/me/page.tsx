"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { Button, Card, Chip, ColorPicker, PageHeader, Spinner } from "@/components/ui";
import { useAiStatus, useItems, useProfile } from "@/hooks/data";
import { db, exportAll, importAll, saveProfile, wipeAll } from "@/lib/db";
import { verifyBackgroundRemoval } from "@/lib/image";
import { topStyles } from "@/lib/style";
import { CATEGORY_LABELS, COLORS, COLOR_NAMES, OCCASIONS, OCCASION_INFO, STYLE_INFO, type ColorName } from "@/lib/taxonomy";
import { searchCity, type GeoResult } from "@/lib/weather";

export default function MePage() {
  const profile = useProfile();
  const items = useItems();
  const ai = useAiStatus();
  const logs = useLiveQuery(() => db.wearLogs.count(), []);
  const outfits = useLiveQuery(() => db.outfits.count(), []);

  if (!profile || !items) return <Spinner />;
  const styles = topStyles(profile.styleWeights, 3);

  return (
    <div className="space-y-6">
      <PageHeader title="Me" subtitle={`${items.length} pieces · ${outfits ?? 0} saved outfits · ${logs ?? 0} days logged`} />

      <section className="rounded-[28px] bg-ink p-5 text-bg">
        <p className="text-xs tracking-wide uppercase opacity-60">Your style mix</p>
        {styles.length ? (
          <div className="mt-3 space-y-3">
            {styles.map(({ style, pct }) => (
              <div key={style}>
                <div className="flex justify-between text-sm">
                  <span>{STYLE_INFO[style].emoji} {STYLE_INFO[style].label}</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-[#e9c53e]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm">Not set yet.</p>
        )}
        <Link href="/onboarding" className="mt-4 inline-block text-sm underline opacity-80">
          Retake the style quiz
        </Link>
      </section>

      <Insights />

      <Card className="space-y-5">
        <h2 className="font-semibold">Preferences</h2>
        <CitySetting />
        <div>
          <p className="mb-2 text-sm font-medium">Clothes shown</p>
          <div className="flex flex-wrap gap-2">
            {(["womenswear", "menswear", "both"] as const).map((w) => (
              <Chip key={w} selected={profile.wardrobe === w} onClick={() => saveProfile({ wardrobe: w })}>{w}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Default occasion</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <Chip key={o} selected={profile.lifestyle[0] === o} onClick={() => saveProfile({ lifestyle: [o, ...profile.lifestyle.filter((x) => x !== o)] })}>
                {OCCASION_INFO[o].emoji} {OCCASION_INFO[o].label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Colours to avoid</p>
          <ColorPicker value={profile.avoidColors} onChange={(c) => saveProfile({ avoidColors: c })} max={8} />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">AI & photos</h2>
        <BgRemovalSetting enabled={profile.backgroundRemoval} />
        <div className="rounded-2xl bg-soft p-3 text-sm">
          <p>
            <b>AI tagging & stylist:</b> {ai === undefined ? "checking…" : ai.ai ? "✅ on" : "off — set ANTHROPIC_API_KEY on the server"}
          </p>
          <p className="mt-1">
            <b>Product search:</b> {ai?.shopping ? "✅ on" : "off — set SERPAPI_API_KEY (search links still work)"}
          </p>
          <p className="mt-2 text-xs text-muted">
            Your closet is stored only in this browser. Photos are sent to the AI only when you add an item or analyse an inspiration, and are not stored on the server.
          </p>
        </div>
      </Card>

      <DataSettings />
    </div>
  );
}

function Insights() {
  const items = useItems();
  const stats = useMemo(() => {
    const active = (items ?? []).filter((i) => i.status !== "archived");
    const never = active.filter((i) => i.wearCount === 0);
    const most = [...active].sort((a, b) => b.wearCount - a.wearCount).filter((i) => i.wearCount > 0).slice(0, 3);
    const priced = active.filter((i) => i.price);
    const value = priced.reduce((a, i) => a + (i.price ?? 0), 0);
    const colorCount = new Map<ColorName, number>();
    for (const i of active) if (i.colors[0]) colorCount.set(i.colors[0], (colorCount.get(i.colors[0]) ?? 0) + 1);
    const colors = COLOR_NAMES.filter((c) => colorCount.get(c)).map((c) => ({ c, n: colorCount.get(c)! })).sort((a, b) => b.n - a.n);
    const byCat = new Map<string, number>();
    for (const i of active) byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1);
    const bestCpw = priced
      .filter((i) => i.wearCount > 0)
      .map((i) => ({ i, cpw: i.price! / i.wearCount }))
      .sort((a, b) => a.cpw - b.cpw)
      .slice(0, 3);
    return { active, never, most, value, colors, byCat, bestCpw, priced };
  }, [items]);

  if (!items?.length) return null;
  const total = stats.active.length || 1;

  return (
    <Card className="space-y-5">
      <h2 className="font-semibold">Wardrobe insights</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-soft p-3">
          <div className="text-xl font-semibold">{Math.round(((total - stats.never.length) / total) * 100)}%</div>
          <div className="text-xs text-muted">worn at least once</div>
        </div>
        <div className="rounded-2xl bg-soft p-3">
          <div className="text-xl font-semibold">{stats.never.length}</div>
          <div className="text-xs text-muted">never worn</div>
        </div>
        <div className="rounded-2xl bg-soft p-3">
          <div className="text-xl font-semibold">{stats.priced.length ? Math.round(stats.value) : "—"}</div>
          <div className="text-xs text-muted">closet value</div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Colour palette</p>
        <div className="flex h-4 overflow-hidden rounded-full">
          {stats.colors.map(({ c, n }) => (
            <span key={c} title={`${c}: ${n}`} style={{ flex: n, background: COLORS[c] }} className="h-full" />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{stats.colors.slice(0, 4).map(({ c, n }) => `${c} ${Math.round((n / total) * 100)}%`).join(" · ")}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">By category</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[...stats.byCat.entries()].map(([c, n]) => (
            <span key={c} className="rounded-full bg-soft px-2.5 py-1">{CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]} {n}</span>
          ))}
        </div>
      </div>

      {stats.most.length > 0 && <ItemStrip title="Most worn" items={stats.most.map((i) => ({ item: i, note: `${i.wearCount}×` }))} />}
      {stats.bestCpw.length > 0 && <ItemStrip title="Best cost per wear" items={stats.bestCpw.map(({ i, cpw }) => ({ item: i, note: cpw.toFixed(2) }))} />}
      {stats.never.length > 0 && (
        <ItemStrip title="Waiting for their first outing" items={stats.never.slice(0, 6).map((i) => ({ item: i, note: "style it →", href: `/?anchor=${i.id}` }))} />
      )}
    </Card>
  );
}

function ItemStrip({ title, items }: { title: string; items: { item: NonNullable<ReturnType<typeof useItems>>[number]; note: string; href?: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {items.map(({ item, note, href }) => {
          const inner = (
            <>
              <ItemImage blob={item.thumb} alt={item.name} className="h-16 w-16 rounded-xl" />
              <p className="mt-0.5 text-center text-[11px] text-muted">{note}</p>
            </>
          );
          return href ? (
            <Link key={item.id} href={href} className="shrink-0">{inner}</Link>
          ) : (
            <div key={item.id} className="shrink-0">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

function CitySetting() {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  return (
    <div id="city">
      <p className="mb-2 text-sm font-medium">City for weather {profile?.city && <span className="font-normal text-muted">· {profile.city.name}</span>}</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            setResults(await searchCity(q));
          } finally {
            setLoading(false);
          }
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city" className="h-10 flex-1 rounded-full border border-line bg-bg px-4 text-sm" />
        <Button size="sm" variant="secondary" type="submit" disabled={q.trim().length < 2}>{loading ? <Spinner /> : "Search"}</Button>
      </form>
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={async () => {
                  await saveProfile({ city: { name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country } });
                  setResults([]);
                  setQ("");
                }}
              >
                {r.name} <span className="text-muted">· {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BgRemovalSetting({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [pct, setPct] = useState(0);
  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <span className="font-medium">Remove photo backgrounds</span>
          <span className="block text-xs text-muted">Experimental · runs on your device (BiRefNet lite, ~100–200 MB download once, needs WebGPU).</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--accent)]"
          checked={enabled}
          onChange={async (e) => {
            const on = e.target.checked;
            await saveProfile({ backgroundRemoval: on });
            if (on) {
              setState("loading");
              try {
                await verifyBackgroundRemoval((p) => setPct(p));
                setState("idle");
              } catch (err) {
                console.error(err);
                setState("error");
                await saveProfile({ backgroundRemoval: false });
              }
            }
          }}
        />
      </label>
      {state === "loading" && <p className="mt-2 text-xs text-muted"><Spinner /> Downloading & testing model… {Math.round(pct)}%</p>}
      {state === "error" && (
        <p className="mt-2 text-xs text-bad">This device/browser can&apos;t run the cut-out model, so photos keep their background. Tip: a plain wall or bedsheet behind clothes looks great too.</p>
      )}
    </div>
  );
}

function DataSettings() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Your data</h2>
      <p className="text-xs text-muted">Everything lives in this browser. Export a backup to move devices.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const blob = await exportAll();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `bgadai-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Export backup
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Import backup</Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await importAll(f);
            setMsg("Backup imported ✓");
          } catch (err) {
            setMsg((err as Error).message);
          }
          e.target.value = "";
        }}
      />
      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={async () => {
          if (confirm("Delete your whole closet, outfits and profile from this device?")) {
            await wipeAll();
            router.replace("/onboarding");
          }
        }}
      >
        Delete all data
      </Button>
      {msg && <p className="text-sm">{msg}</p>}
    </Card>
  );
}
