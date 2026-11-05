"use client";
import type { Item } from "@/lib/types";
import { ItemImage } from "./ItemImage";

const ORDER = ["outerwear", "top", "onepiece", "bottom", "shoes", "bag", "accessory"];

/**
 * Lays an outfit out like a flat lay: main garments large on the left,
 * outerwear / shoes / accessories stacked on the right.
 */
export function OutfitBoard({
  items,
  onPieceClick,
  compact,
}: {
  items: Item[];
  onPieceClick?: (item: Item) => void;
  compact?: boolean;
}) {
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  const main = sorted.filter((i) => ["top", "onepiece", "bottom"].includes(i.category));
  const side = sorted.filter((i) => !["top", "onepiece", "bottom"].includes(i.category));
  const h = compact ? "h-44" : "h-72";

  const Piece = ({ item, className }: { item: Item; className: string }) => (
    <button
      type="button"
      disabled={!onPieceClick}
      onClick={() => onPieceClick?.(item)}
      className={`group relative block min-h-0 overflow-hidden rounded-2xl ${className}`}
      aria-label={onPieceClick ? `Swap ${item.name}` : item.name}
    >
      <ItemImage blob={item.thumb} alt={item.name} className="h-full w-full" />
      {onPieceClick && (
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-medium text-muted opacity-90">
          swap
        </span>
      )}
    </button>
  );

  return (
    <div className={`grid ${h} grid-cols-[3fr_2fr] grid-rows-[minmax(0,1fr)] gap-2`}>
      <div className="grid min-h-0 gap-2" style={{ gridTemplateRows: `repeat(${Math.max(main.length, 1)}, minmax(0, 1fr))` }}>
        {main.map((i) => (
          <Piece key={i.id} item={i} className="h-full w-full" />
        ))}
      </div>
      <div className="grid min-h-0 gap-2" style={{ gridTemplateRows: `repeat(${Math.max(side.length, 1)}, minmax(0, 1fr))` }}>
        {side.map((i) => (
          <Piece key={i.id} item={i} className="h-full w-full" />
        ))}
      </div>
    </div>
  );
}
