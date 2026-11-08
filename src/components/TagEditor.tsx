"use client";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  FORMALITY_LABELS,
  PATTERNS,
  SEASONS,
  STYLES,
  STYLE_INFO,
  SUBCATEGORIES,
  WARMTH_LABELS,
  subLabel,
  type Category,
} from "@/lib/taxonomy";
import type { ItemTags } from "@/lib/types";
import { Chip, ColorPicker } from "./ui";

/** Edit AI-suggested tags. Every field maps to a closet filter. */
export function TagEditor({ value, onChange }: { value: ItemTags; onChange: (v: ItemTags) => void }) {
  const set = <K extends keyof ItemTags>(k: K, v: ItemTags[K]) => onChange({ ...value, [k]: v });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="space-y-5 text-sm">
      <Field label="Name">
        <input
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          className="h-11 w-full rounded-tile border border-line bg-bg px-3 outline-none focus:border-ink"
        />
      </Field>

      <Field label="Category">
        <Row>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={value.category === c}
              onClick={() => onChange({ ...value, category: c, subcategory: SUBCATEGORIES[c][0] })}
            >
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </Row>
      </Field>

      <Field label="Type">
        <Row>
          {(SUBCATEGORIES[value.category as Category] as readonly string[]).map((s) => (
            <Chip key={s} selected={value.subcategory === s} onClick={() => set("subcategory", s as ItemTags["subcategory"])}>
              {subLabel(s)}
            </Chip>
          ))}
        </Row>
      </Field>

      <Field label="Colours (dominant first)">
        <ColorPicker value={value.colors} onChange={(c) => set("colors", c)} />
      </Field>

      <Field label="Pattern">
        <Row>
          {PATTERNS.map((p) => (
            <Chip key={p} selected={value.pattern === p} onClick={() => set("pattern", p)}>
              {p}
            </Chip>
          ))}
        </Row>
      </Field>

      <Field label={`Formality · ${FORMALITY_LABELS[value.formality]}`}>
        <input type="range" min={1} max={5} value={value.formality} onChange={(e) => set("formality", +e.target.value)} className="w-full accent-[var(--accent)]" />
      </Field>

      <Field label={`Warmth · ${WARMTH_LABELS[value.warmth]}`}>
        <input type="range" min={1} max={5} value={value.warmth} onChange={(e) => set("warmth", +e.target.value)} className="w-full accent-[var(--accent)]" />
      </Field>

      <Field label="Seasons">
        <Row>
          {SEASONS.map((s) => (
            <Chip key={s} selected={value.seasons.includes(s)} onClick={() => set("seasons", toggle(value.seasons, s))}>
              {s}
            </Chip>
          ))}
        </Row>
      </Field>

      <Field label="Style">
        <Row>
          {STYLES.map((s) => (
            <Chip key={s} selected={value.styles.includes(s)} onClick={() => set("styles", toggle(value.styles, s))}>
              {STYLE_INFO[s].emoji} {s}
            </Chip>
          ))}
        </Row>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      {children}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
