"use client";
import { useEffect, useRef } from "react";
import { COLORS, type ColorName } from "@/lib/taxonomy";

/** Oversized display title with an accent line (wide caps in Editorial, purple script in Synth). */
export function PageHeader({
  title,
  accent,
  subtitle,
  action,
}: {
  title: string;
  accent?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="relative mb-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="display text-[44px]">{title}</h1>
        {action && <div className="pt-1">{action}</div>}
      </div>
      {accent && <p className="accent-line accent-lg mt-1">{accent}</p>}
      {subtitle && <p className="mt-2 max-w-[30ch] text-[13px] leading-snug text-muted">{subtitle}</p>}
    </header>
  );
}

/** Centered section heading, like the "OUR PRODUCT" / "DESIGNED BY PROFESSIONALS." blocks. */
export function SectionTitle({ children, accent, className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <h2 className="display text-[26px]">{children}</h2>
      {accent && <p className="accent-line accent-sm mt-1">{accent}</p>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "primary", size = "md", className = "", ...props }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-btn font-semibold uppercase tracking-[0.08em] transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text";
  const sizes = { sm: "h-9 px-3.5 text-[11px]", md: "h-12 px-5 text-[12.5px]" };
  const variants = {
    primary: "bg-accent text-accent-ink hover:opacity-90",
    secondary: "border border-edge bg-transparent text-ink hover:bg-soft",
    ghost: "text-ink hover:bg-soft",
    danger: "border border-edge text-bad hover:bg-soft",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

/** Filter chip: square outlined tag (Editorial) / subtle pill (Synth). Selected = filled. */
export function Chip({
  selected,
  children,
  onClick,
  className = "",
}: {
  selected?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-btn border px-3 text-[10.5px] font-semibold tracking-[0.1em] uppercase transition ${
        selected ? "border-accent bg-accent text-accent-ink" : "border-edge text-ink hover:bg-soft"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-card p-4 ${className}`}>{children}</div>;
}

/** Big-number stats row, e.g. "24 PIECES · 7 CATEGORIES". */
export function Stats({ items }: { items: { value: React.ReactNode; label: string }[] }) {
  return (
    <dl className="grid border-y border-line py-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="text-center">
          <dd className="display text-[24px]">{s.value}</dd>
          <dt className="label mt-1 text-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Decorative asterisk from the editorial look. */
export function Asterisk({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`only-editorial ${className}`} aria-hidden>
      <g fill="currentColor">
        {[0, 45, 90, 135].map((r) => (
          <rect key={r} x="41" y="0" width="18" height="100" rx="2" transform={`rotate(${r} 50 50)`} />
        ))}
      </g>
    </svg>
  );
}

export function Swatch({ color, size = 16, ring }: { color: ColorName; size?: number; ring?: boolean }) {
  const metallic = color === "metallic";
  return (
    <span
      title={color}
      className={`inline-block shrink-0 rounded-full border border-black/10 ${ring ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
      style={{
        width: size,
        height: size,
        background: metallic ? "linear-gradient(135deg,#f3e3b0,#b8975a,#f3e3b0)" : COLORS[color],
      }}
    />
  );
}

export function ColorPicker({
  value,
  onChange,
  max = 3,
}: {
  value: ColorName[];
  onChange: (v: ColorName[]) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {(Object.keys(COLORS) as ColorName[]).map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== c) : [...value, c].slice(-max))}
            className="rounded-full p-0.5"
          >
            <Swatch color={c} size={26} ring={on} />
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-card border-t border-edge bg-card p-0 text-ink backdrop:bg-black/50 sm:mx-auto sm:max-w-md"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-card px-5 pt-4 pb-3">
        <h2 className="display truncate text-[22px]">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-btn border border-edge">
          ✕
        </button>
      </div>
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)]">{open && children}</div>
    </dialog>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-hidden />;
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-card border border-dashed border-edge px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <h3 className="display mt-4 text-[22px]">{title}</h3>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="label w-20 shrink-0 text-muted">{label}</span>
      <span className="h-1 flex-1 overflow-hidden bg-soft">
        <span className="block h-full bg-ink dark:bg-accent-text" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="w-8 text-right tabular-nums text-muted">{Math.round(value * 100)}</span>
    </div>
  );
}
