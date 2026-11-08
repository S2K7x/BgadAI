"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { SampleClosetButton } from "@/components/SampleClosetButton";
import { TagEditor } from "@/components/TagEditor";
import { Button, Chip, Empty, PageHeader, Sheet, Spinner, Stats, Swatch } from "@/components/ui";
import { useItems } from "@/hooks/data";
import { db, setLaundry } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABELS, COLOR_NAMES, subLabel, type Category, type ColorName } from "@/lib/taxonomy";
import type { Item, ItemTags } from "@/lib/types";

type SortKey = "recent" | "most" | "least" | "colour" | "category";
const SORTS: Record<SortKey, { label: string; fn: (a: Item, b: Item) => number }> = {
  recent: { label: "Recently added", fn: (a, b) => b.createdAt - a.createdAt },
  most: { label: "Most worn", fn: (a, b) => b.wearCount - a.wearCount },
  least: { label: "Least worn", fn: (a, b) => a.wearCount - b.wearCount || (a.lastWornAt ?? 0) - (b.lastWornAt ?? 0) },
  colour: { label: "Colour", fn: (a, b) => COLOR_NAMES.indexOf(a.colors[0]) - COLOR_NAMES.indexOf(b.colors[0]) },
  category: { label: "Category", fn: (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) },
};

export default function ClosetPage() {
  const items = useItems();
  const router = useRouter();
  const [cat, setCat] = useState<Category | "all">("all");
  const [color, setColor] = useState<ColorName>();
  const [q, setQ] = useState("");
  const [showLaundry, setShowLaundry] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Item>();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (items ?? []).filter(
      (i) =>
        i.status !== "archived" &&
        (showLaundry || i.status === "active") &&
        (cat === "all" || i.category === cat) &&
        (!color || i.colors.includes(color)) &&
        (!needle || `${i.name} ${i.subcategory} ${i.brand ?? ""} ${i.colors.join(" ")} ${i.styles.join(" ")}`.toLowerCase().includes(needle)),
    );
    return [...list].sort(SORTS[sort].fn);
  }, [items, cat, color, q, showLaundry, sort]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items ?? []) if (i.status !== "archived") m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);
  const active = useMemo(() => (items ?? []).filter((i) => i.status !== "archived"), [items]);
  const outfitCount = useLiveQuery(() => db.outfits.count(), []);
  const usedColors = useMemo(() => COLOR_NAMES.filter((c) => items?.some((i) => i.colors.includes(c))), [items]);

  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Closet"
        accent="Your collection."
        subtitle="Every piece you own, tagged and ready to style."
        action={
          <Link href="/closet/add">
            <Button size="sm">+ Add</Button>
          </Link>
        }
      />
      {items.length > 0 && (
        <div className="mb-6">
          <Stats
            items={[
              { value: active.length, label: "Pieces" },
              { value: counts.size, label: "Categories" },
              { value: outfitCount ?? 0, label: "Outfits" },
              { value: `${active.length ? Math.round((active.filter((i) => i.wearCount > 0).length / active.length) * 100) : 0}%`, label: "Worn" },
            ]}
          />
        </div>
      )}

      {items.length === 0 ? (
        <Empty emoji="🧺" title="Your closet is empty">
          <p>Start with 5 everyday pieces — a top, a bottom, shoes and a layer.</p>
          <Link href="/closet/add?quick=1">
            <Button className="mt-4">Quick start</Button>
          </Link>
          <SampleClosetButton className="mt-2" />
        </Empty>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, brand, colour, style…"
            className="mb-4 h-11 w-full rounded-btn border border-edge bg-transparent px-4 text-sm outline-none placeholder:text-muted focus:border-ink"
          />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip selected={cat === "all"} onClick={() => setCat("all")}>All</Chip>
            {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
                {CATEGORY_LABELS[c]} <span className="opacity-60">{counts.get(c)}</span>
              </Chip>
            ))}
          </div>
          <div className="no-scrollbar -mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 py-1">
            {usedColors.map((c) => (
              <button key={c} aria-label={`Filter ${c}`} aria-pressed={color === c} onClick={() => setColor(color === c ? undefined : c)} className="p-0.5">
                <Swatch color={c} size={22} ring={color === c} />
              </button>
            ))}
            <label className="label ml-auto flex shrink-0 items-center gap-1.5 text-muted">
              <input type="checkbox" checked={showLaundry} onChange={(e) => setShowLaundry(e.target.checked)} className="accent-[var(--accent)]" />
              show laundry
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="label flex items-center gap-2 text-muted">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="label h-8 rounded-btn border border-edge bg-transparent px-2 text-ink"
              >
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>{SORTS[k].label}</option>
                ))}
              </select>
            </label>
            <button
              className="label h-8 rounded-btn border border-edge px-3"
              onClick={() => {
                setSelecting(!selecting);
                setPicked(new Set());
              }}
            >
              {selecting ? "Done" : "Select"}
            </button>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6">
            {visible.map((i) => (
              <li key={i.id} className="cv-auto">
                <button
                  onClick={() => {
                    if (!selecting) return setOpen(i);
                    const next = new Set(picked);
                    if (next.has(i.id)) next.delete(i.id);
                    else next.add(i.id);
                    setPicked(next);
                  }}
                  aria-pressed={selecting ? picked.has(i.id) : undefined}
                  className={`group block w-full text-center ${selecting && picked.has(i.id) ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                >
                  <div className="relative">
                    <ItemImage
                      blob={i.thumb}
                      alt={i.name}
                      className={`aspect-[3/4] transition group-active:scale-[0.98] ${i.status === "laundry" ? "opacity-40" : ""}`}
                    />
                    {i.status === "laundry" && <span className="label absolute top-2 left-2 bg-card px-1.5 py-0.5">Laundry</span>}
                    {selecting && (
                      <span className={`absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-btn border-2 border-ink text-[13px] ${picked.has(i.id) ? "bg-ink text-bg" : "bg-card"}`}>
                        {picked.has(i.id) ? "✓" : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[12.5px] font-medium">{i.name}</p>
                  <p className="label mt-0.5 text-muted">
                    {subLabel(i.subcategory)} · {i.wearCount ? `worn ${i.wearCount}×` : "new"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className="mt-8 text-center text-sm text-muted">No pieces match these filters.</p>}

          {selecting && (
            <div className="sticky bottom-24 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-card border border-edge bg-card p-2 shadow-lg">
              <span className="label px-1">{picked.size} selected</span>
              <button className="label ml-auto" onClick={() => setPicked(picked.size === visible.length ? new Set() : new Set(visible.map((i) => i.id)))}>
                {picked.size === visible.length ? "None" : "All"}
              </button>
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={async () => { await setLaundry([...picked], true); setPicked(new Set()); }}>🧺 Laundry</Button>
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={async () => { await setLaundry([...picked], false); setPicked(new Set()); }}>Clean</Button>
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={async () => { await db.items.where("id").anyOf([...picked]).modify({ status: "archived" }); setPicked(new Set()); }}>Archive</Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!picked.size}
                onClick={async () => {
                  if (confirm(`Delete ${picked.size} piece${picked.size > 1 ? "s" : ""}?`)) {
                    await db.items.bulkDelete([...picked]);
                    setPicked(new Set());
                  }
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(undefined)} title={open?.name}>
        {open && (
          <ItemDetail
            item={open}
            onClose={() => setOpen(undefined)}
            onStyle={() => router.push(`/?anchor=${open.id}`)}
          />
        )}
      </Sheet>
    </div>
  );
}

function ItemDetail({ item, onClose, onStyle }: { item: Item; onClose: () => void; onStyle: () => void }) {
  const [tags, setTags] = useState<ItemTags>(item);
  const [brand, setBrand] = useState(item.brand ?? "");
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  const cpw = item.price && item.wearCount ? item.price / item.wearCount : undefined;

  const save = async () => {
    const p = parseFloat(price.replace(",", "."));
    await db.items.update(item.id, { ...tags, brand: brand.trim() || undefined, price: Number.isFinite(p) ? p : undefined });
    onClose();
  };

  return (
    <div>
      <ItemImage blob={item.image} alt={item.name} className="h-64 rounded-card" />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Worn" value={`${item.wearCount}×`} />
        <Stat label="Last worn" value={item.lastWornAt ? new Date(item.lastWornAt).toLocaleDateString() : "never"} />
        <Stat label="Cost / wear" value={cpw ? cpw.toFixed(2) : "—"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onStyle}>✨ Style this</Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await setLaundry([item.id], item.status !== "laundry");
            onClose();
          }}
        >
          {item.status === "laundry" ? "Back from laundry" : "🧺 In laundry"}
        </Button>
      </div>

      {!editing ? (
        <button className="mt-5 w-full text-sm font-medium text-accent-text" onClick={() => setEditing(true)}>
          Edit details
        </button>
      ) : (
        <div className="mt-6 space-y-5">
          <TagEditor value={tags} onChange={setTags} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              <span className="mb-1 block text-xs font-medium text-muted uppercase">Brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11 w-full rounded-tile border border-line bg-bg px-3" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted uppercase">Price paid</span>
              <input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} className="h-11 w-full rounded-tile border border-line bg-bg px-3" />
            </label>
          </div>
          <Button className="w-full" onClick={save}>Save changes</Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (confirm(`Delete "${item.name}" from your closet?`)) {
                await db.items.delete(item.id);
                onClose();
              }
            }}
          >
            Delete item
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-soft p-2.5">
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="text-muted">{label}</div>
    </div>
  );
}
