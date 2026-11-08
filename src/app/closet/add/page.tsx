"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { TagEditor } from "@/components/TagEditor";
import { Button, Card, PageHeader, Sheet, Spinner, Swatch } from "@/components/ui";
import { useAiStatus, useItems, useProfile } from "@/hooks/data";
import type { AnalyzeResult } from "@/lib/ai/schemas";
import { db, uid } from "@/lib/db";
import { blobToBase64, extractColors, removeBackground, resizeImage } from "@/lib/image";
import { CATEGORY_LABELS, subLabel, type Category } from "@/lib/taxonomy";
import type { ItemTags } from "@/lib/types";

type Draft = {
  key: string;
  status: "processing" | "ready" | "error";
  stage: string;
  preview?: Blob;
  image?: Blob;
  thumb?: Blob;
  tags: ItemTags;
  aiTagged: boolean;
  error?: string;
  note?: string;
};

const nowMs = () => Date.now();

const DEFAULT_TAGS: ItemTags = {
  name: "New piece",
  category: "top",
  subcategory: "t-shirt",
  colors: [],
  pattern: "solid",
  formality: 2,
  warmth: 2,
  seasons: ["spring", "summer", "autumn"],
  styles: [],
};

const QUICK: { label: string; cats: Category[] }[] = [
  { label: "A top", cats: ["top"] },
  { label: "A bottom", cats: ["bottom", "onepiece"] },
  { label: "Shoes", cats: ["shoes"] },
  { label: "A layer", cats: ["outerwear"] },
  { label: "One more", cats: ["top", "bottom", "onepiece", "bag", "accessory", "outerwear", "shoes"] },
];

export default function AddPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AddItems />
    </Suspense>
  );
}

function AddItems() {
  const router = useRouter();
  const quick = useSearchParams().get("quick") === "1";
  const ai = useAiStatus();
  const profile = useProfile();
  const existing = useItems();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [multi, setMulti] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [saving, setSaving] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const finishPiece = async (key: string, crop: Blob, tags: ItemTags, aiTagged: boolean) => {
    let cut: Blob = crop;
    let note: string | undefined;
    if (profile?.backgroundRemoval) {
      update(key, { stage: "Removing background…" });
      try {
        cut = await removeBackground(crop, (pct) => update(key, { stage: `Downloading cut-out model… ${Math.round(pct)}%` }));
      } catch (e) {
        console.warn("Background removal failed", e);
        note = "Kept original background";
      }
    }
    const image = await resizeImage(cut, 1024, { type: "image/webp", quality: 0.88 });
    const thumb = await resizeImage(image, 360, { type: "image/webp", quality: 0.82 });
    const colors = tags.colors.length ? tags.colors : await extractColors(image);
    update(key, { status: "ready", stage: "", image, thumb, preview: thumb, tags: { ...tags, colors }, aiTagged, note });
  };

  const processFile = async (file: File) => {
    const key = uid();
    setDrafts((ds) => [...ds, { key, status: "processing", stage: "Preparing photo…", tags: DEFAULT_TAGS, aiTagged: false }]);
    try {
      const base = await resizeImage(file, 1600, { type: "image/jpeg", quality: 0.9 });
      update(key, { preview: await resizeImage(base, 360, { type: "image/jpeg", quality: 0.8 }) });

      if (ai?.ai) {
        update(key, { stage: multi ? "Finding each piece…" : "Recognising item…" });
        const small = await resizeImage(base, 1024, { type: "image/jpeg", quality: 0.85 });
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: await blobToBase64(small), mediaType: "image/jpeg", multi }),
        });
        const data = (await res.json()) as AnalyzeResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "AI analysis failed");
        if (!data.items.length) throw new Error("No clothing found in this photo");

        const [first, ...rest] = data.items;
        const extraKeys = rest.map(() => uid());
        if (rest.length) {
          setDrafts((ds) => {
            const idx = ds.findIndex((d) => d.key === key);
            const extras: Draft[] = extraKeys.map((k) => ({ key: k, status: "processing", stage: "Cutting out…", tags: DEFAULT_TAGS, aiTagged: true }));
            return [...ds.slice(0, idx + 1), ...extras, ...ds.slice(idx + 1)];
          });
        }
        const pieces = [{ key, it: first }, ...rest.map((it, i) => ({ key: extraKeys[i], it }))];
        for (const { key: k, it } of pieces) {
          const { box, ...tags } = it;
          const crop = multi ? await resizeImage(base, 1280, { type: "image/jpeg", quality: 0.92, box: [box.x0, box.y0, box.x1, box.y1] }) : base;
          await finishPiece(k, crop, tags as ItemTags, true);
        }
      } else {
        await finishPiece(key, base, DEFAULT_TAGS, false);
      }
    } catch (e) {
      update(key, { status: "error", stage: "", error: (e as Error).message });
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      queue.current = queue.current.then(() => processFile(f));
    }
  };

  const ready = drafts.filter((d) => d.status === "ready");
  const processing = drafts.some((d) => d.status === "processing");

  const saveAll = async () => {
    setSaving(true);
    const now = nowMs();
    await db.items.bulkAdd(
      ready.map((d, i) => ({
        ...d.tags,
        name: d.tags.name.trim() || CATEGORY_LABELS[d.tags.category],
        id: uid(),
        createdAt: now + i,
        image: d.image!,
        thumb: d.thumb!,
        status: "active" as const,
        wearCount: 0,
      })),
    );
    const total = (existing?.length ?? 0) + ready.length;
    router.push(quick && total >= 3 ? "/" : "/closet");
  };

  const allCats = [...(existing ?? []).map((i) => i.category), ...ready.filter((d) => d.aiTagged).map((d) => d.tags.category)];
  const editingDraft = drafts.find((d) => d.key === editing);

  return (
    <div>
      <PageHeader
        title={quick ? "Quick start" : "Add"}
        accent="Snap. Tag. Done."
        subtitle={quick ? "Add 5 pieces and we'll style your first outfit." : "Snap one item per photo — or a flat lay of several."}
        action={!quick && <Link href="/closet" className="text-sm text-muted">Cancel</Link>}
      />

      {quick && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {QUICK.map((q, i) => {
            const have = i === 4 ? allCats.length >= 5 : allCats.some((c) => q.cats.includes(c));
            return (
              <span key={q.label} className={`label shrink-0 rounded-btn border px-3 py-2 ${have ? "border-good bg-good/10 text-good" : "border-line text-muted"}`}>
                {have ? "✓" : "○"} {q.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => cameraRef.current?.click()} className="flex h-32 flex-col items-center justify-center gap-2 rounded-card bg-ink text-bg dark:border dark:border-line dark:bg-card dark:text-ink active:scale-[0.98]">
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">Take photo</span>
        </button>
        <button onClick={() => galleryRef.current?.click()} className="flex h-32 flex-col items-center justify-center gap-2 rounded-card border border-line bg-card active:scale-[0.98]">
          <span className="text-3xl">🖼️</span>
          <span className="text-sm font-medium">Choose photos</span>
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

      <Card className="mt-3 space-y-3 text-sm">
        <label className={`flex items-center justify-between gap-3 ${ai?.ai ? "" : "opacity-50"}`}>
          <span>
            <span className="font-medium">Several items per photo</span>
            <span className="block text-xs text-muted">Lay clothes flat on the bed or floor — AI splits them up.</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={multi} disabled={!ai?.ai} onChange={(e) => setMulti(e.target.checked)} />
        </label>
        <p className="text-xs text-muted">
          {ai === undefined ? "Checking AI…" : ai.ai ? "✨ AI will tag category, colours, formality and season." : "AI tagging is off (no API key) — colours are detected on-device and you pick the type."}
          {profile && !profile.backgroundRemoval && (
            <> Background removal is off — <Link href="/me" className="underline">turn it on</Link>.</>
          )}
        </p>
      </Card>

      {drafts.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">
            {ready.length} ready{processing && " · processing…"}
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {drafts.map((d) => (
              <li key={d.key} className="pop-in overflow-hidden rounded-card border border-line bg-card">
                <div className="relative aspect-square">
                  <ItemImage blob={d.preview} alt={d.tags.name} className="h-full w-full" />
                  {d.status === "processing" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 p-3 text-center text-xs text-muted backdrop-blur-[2px]">
                      <Spinner className="text-accent-text" />
                      {d.stage}
                    </div>
                  )}
                  <button
                    onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                    aria-label="Remove"
                    className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-card/90 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-3">
                  {d.status === "error" ? (
                    <p className="text-xs text-bad">{d.error}</p>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium">{d.tags.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        {d.tags.colors.map((c) => <Swatch key={c} color={c} size={12} />)}
                        <span className="truncate">{subLabel(d.tags.subcategory)}</span>
                      </div>
                      {d.note && <p className="mt-1 text-[11px] text-muted">{d.note}</p>}
                      <button disabled={d.status !== "ready"} onClick={() => setEditing(d.key)} className={`mt-2 text-xs font-medium ${d.aiTagged ? "text-accent-text" : "text-bad"}`}>
                        {d.aiTagged ? "Edit tags" : "Set type & tags →"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready.length > 0 && (
        <div className="sticky bottom-24 z-20 mt-6">
          <Button className="w-full shadow-lg" onClick={saveAll} disabled={saving || processing}>
            {saving ? <Spinner /> : `Save ${ready.length} to closet`}
          </Button>
        </div>
      )}

      <Sheet open={!!editingDraft} onClose={() => setEditing(undefined)} title="Item details">
        {editingDraft && (
          <>
            <ItemImage blob={editingDraft.thumb} alt="" className="mb-5 h-48 rounded-tile" />
            <TagEditor value={editingDraft.tags} onChange={(tags) => update(editingDraft.key, { tags, aiTagged: true })} />
            <Button className="mt-6 w-full" onClick={() => setEditing(undefined)}>Done</Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
