"use client";
import { useBlobUrl } from "@/hooks/data";

/** A garment photo (usually a background-removed cut-out) on a soft backdrop. */
export function ItemImage({
  blob,
  alt,
  className = "",
  fit = "contain",
}: {
  blob?: Blob;
  alt: string;
  className?: string;
  fit?: "contain" | "cover";
}) {
  const url = useBlobUrl(blob);
  return (
    <div className={`cutout-bg overflow-hidden ${className}`}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URLs, nothing for next/image to optimise
        <img
          src={url}
          alt={alt}
          draggable={false}
          className={`h-full w-full ${fit === "contain" ? "object-contain p-2" : "object-cover"}`}
        />
      )}
    </div>
  );
}
