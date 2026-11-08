"use client";
import { useBlobUrl } from "@/hooks/data";

/** A garment photo on a soft backdrop — cut-corner tile in Editorial, rounded in Synth. */
export function ItemImage({
  blob,
  alt,
  className = "",
  fit = "contain",
  plain,
}: {
  blob?: Blob;
  alt: string;
  className?: string;
  fit?: "contain" | "cover";
  /** Skip the tile shape (for tiny thumbnails where a cut corner reads as noise). */
  plain?: boolean;
}) {
  const url = useBlobUrl(blob);
  return (
    <div className={`cutout-bg overflow-hidden ${plain ? "" : "tile"} ${className}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URLs, nothing for next/image to optimise
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          loading="lazy"
          className={`h-full w-full ${fit === "contain" ? "object-contain p-2" : "object-cover"}`}
        />
      )}
    </div>
  );
}
