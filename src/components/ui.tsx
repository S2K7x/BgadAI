"use client";
import { useEffect, useRef } from "react";
import { COLORS, type ColorName } from "@/lib/taxonomy";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "primary", size = "md", className = "", ...props }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-12 px-5 text-[15px]" };
  const variants = {
    primary: "bg-accent text-accent-ink shadow-sm",
    secondary: "bg-card text-ink border border-line",
    ghost: "text-ink hover:bg-soft",
    danger: "bg-card text-bad border border-line",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

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
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition ${
        selected ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}

export function Swatch({ color, size = 16, ring }: { color: ColorName; size?: number; ring?: boolean }) {
  const metallic = color === "metallic";
  return (
    <span
      title={color}
      className={`inline-block shrink-0 rounded-full border border-black/10 ${ring ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`}
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
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-card p-0 text-ink backdrop:bg-black/40 sm:mx-auto sm:max-w-md"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-5 pt-3 pb-2">
        <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
        <h2 className="pt-2 text-lg font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-soft">
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
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="w-8 text-right tabular-nums text-muted">{Math.round(value * 100)}</span>
    </div>
  );
}
