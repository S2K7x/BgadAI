"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { TagEditor } from "@/components/TagEditor";
import { Button, Chip, Empty, PageHeader, Sheet, Spinner, Swatch } from "@/components/ui";
import { useItems } from "@/hooks/data";
import { db } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABELS, COLOR_NAMES, type Category, type ColorName } from "@/lib/taxonomy";
import type { Item, ItemTags } from "@/lib/types";

export default function ClosetPage() {
  const items = useItems();
  const router = useRouter();
  const [cat, setCat] = useState<Category | "all">("all");
  const [color, setColor] = useState<ColorName>();
  const [q, setQ] = useState("");
  const [showLaundry, setShowLaundry] = useState(true);
  const [open, setOpen] = useState<Item>();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        i.status !== "archived" &&
        (showLaundry || i.status === "active") &&
        (cat === "all" || i.category === cat) &&
        (!color || i.colors.includes(color)) &&
        (!needle || `${i.name} ${i.subcategory} ${i.brand ?? ""} ${i.colors.join(" ")} ${i.styles.join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [items, cat, color, q, showLaundry]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items ?? []) if (i.status !== "archived") m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);
  const usedColors = useMemo(() => COLOR_NAMES.filter((c) => items?.some((i) => i.colors.includes(c))), [items]);

  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Closet"
        subtitle={`${items.filter((i) => i.status !== "archived").length} pieces`}
        action={
          <Link href="/closet/add">
            <Button size="sm">+ Add</Button>
          </Link>
        }
      />

      {items.length === 0 ? (
        <Empty emoji="🧺" title="Your closet is empty">
          <p>Start with 5 everyday pieces — a top, a bottom, shoes and a layer.</p>
          <Link href="/closet/add?quick=1">
            <Button className="mt-4">Quick start</Button>
          </Link>
        </Empty>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, brand, colour, style…"
            className="mb-3 h-11 w-full rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-ink"
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
            <label className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={showLaundry} onChange={(e) => setShowLaundry(e.target.checked)} className="accent-[var(--accent)]" />
              show laundry
            </label>
          </div>

          <ul className="mt-4 grid grid-cols-3 gap-2.5">
            {visible.map((i) => (
              <li key={i.id}>
                <button onClick={() => setOpen(i)} className="block w-full text-left">
                  <div className="relative">
                    <ItemImage blob={i.thumb} alt={i.name} className={`aspect-[4/5] rounded-2xl ${i.status === "laundry" ? "opacity-40" : ""}`} />
                    {i.status === "laundry" && <span className="absolute top-1.5 left-1.5 rounded-full bg-card px-1.5 text-[10px]">🧺 laundry</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">{i.name}</p>
                </button>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className="mt-8 text-center text-sm text-muted">No pieces match these filters.</p>}
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
      <ItemImage blob={item.image} alt={item.name} className="h-64 rounded-3xl" />
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
            await db.items.update(item.id, { status: item.status === "laundry" ? "active" : "laundry" });
            onClose();
          }}
        >
          {item.status === "laundry" ? "Back from laundry" : "🧺 In laundry"}
        </Button>
      </div>

      {!editing ? (
        <button className="mt-5 w-full text-sm font-medium text-accent" onClick={() => setEditing(true)}>
          Edit details
        </button>
      ) : (
        <div className="mt-6 space-y-5">
          <TagEditor value={tags} onChange={setTags} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              <span className="mb-1 block text-xs font-medium text-muted uppercase">Brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-bg px-3" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted uppercase">Price paid</span>
              <input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-bg px-3" />
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
    <div className="rounded-2xl bg-soft p-2.5">
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="text-muted">{label}</div>
    </div>
  );
}
