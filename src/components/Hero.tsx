"use client";
import { PieceImage } from "./PieceImage";
import { ItemImage } from "./ItemImage";
import { Asterisk } from "./ui";
import type { ColorName } from "@/lib/taxonomy";

export type HeroVisual = { kind: "photo"; blob: Blob; alt: string } | { kind: "garment"; sub: string; color: ColorName };

/**
 * Giant wordmark + floating garments.
 *  Editorial: the word sits on top and inverts where it crosses the tilted photos (mix-blend difference).
 *  Synth: the word fades metallic *behind* the garment, with a purple script line across it.
 */
export function Hero({
  word,
  accent,
  visuals,
  left,
  right,
}: {
  word: string;
  accent?: string;
  visuals: HeroVisual[];
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const v = visuals.slice(0, 2);
  const tilts = v.length === 2 ? ["-7deg", "6deg"] : ["-4deg"];
  return (
    <section className="hero relative -mx-4 overflow-hidden px-4 pt-2 pb-4 md:-mx-8 md:px-8">
      <Asterisk className="absolute top-[178px] left-1 z-[4] h-10 w-10 text-ink" />

      <div className="relative h-[270px] md:h-[380px] lg:h-[430px]">
        {/* Wordmark */}
        <div className="hero-word-layer pointer-events-none absolute inset-x-0 top-6 select-none">
          <p
            className="hero-word hero-word-size display text-center leading-[0.85] whitespace-nowrap"
            style={{ ["--chars" as string]: Math.max(word.length, 3) }}
          >
            {word}
          </p>
        </div>

        {/* Garments / photos */}
        <div className="absolute inset-0 z-[1] flex items-center justify-center gap-0 pt-8">
          {v.map((vis, i) => (
            <div
              key={i}
              className={`float hero-shadow ${v.length === 2 ? (i === 0 ? "translate-x-3" : "-translate-x-3 translate-y-6") : ""}`}
              style={{ ["--r" as string]: tilts[i], animationDelay: `${i * -2.5}s` }}
            >
              {vis.kind === "photo" ? (
                <ItemImage blob={vis.blob} alt={vis.alt} className="h-[200px] w-[150px] md:h-[280px] md:w-[210px] lg:h-[320px] lg:w-[240px] dark:bg-transparent" />
              ) : (
                <div className="cutout-bg tile grid h-[190px] w-[150px] place-items-center md:h-[270px] md:w-[210px] lg:h-[310px] lg:w-[240px] dark:bg-transparent">
                  <PieceImage eager sub={vis.sub} color={vis.color} className="h-[180px] w-[135px] md:h-[255px] md:w-[190px] lg:h-[295px] lg:w-[220px]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Accent line across the visual */}
        {accent && (
          <p className="accent-line absolute inset-x-0 bottom-3 z-[3] text-center text-[26px] leading-none drop-shadow-sm md:text-[38px]">
            {accent}
          </p>
        )}
      </div>

      {(left || right) && (
        <div className="relative z-[3] mt-2 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">{left}</div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
    </section>
  );
}
