"use client";
import { findSample } from "@/lib/samples";
import type { ColorName } from "@/lib/taxonomy";
import { Garment } from "./Garment";

/**
 * A real product photo for a (type, colour) — e.g. a style-quiz look piece or a missing piece
 * from an inspiration — falling back to the flat SVG illustration if no sample matches.
 */
export function PieceImage({
  sub,
  color,
  wardrobe,
  className = "",
  alt = "",
  eager,
}: {
  sub: string;
  color: ColorName;
  wardrobe?: "womenswear" | "menswear" | "both";
  className?: string;
  alt?: string;
  /** Load immediately (above-the-fold cards like the style quiz). */
  eager?: boolean;
}) {
  const s = findSample(sub, color, wardrobe);
  if (!s) return <Garment sub={sub} color={color} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small pre-optimised static webp; next/image adds no value here
    <img src={s.src} alt={alt || s.name} width={600} height={800} loading={eager ? "eager" : "lazy"} decoding="async" className={`product-photo object-contain ${className}`} />
  );
}
