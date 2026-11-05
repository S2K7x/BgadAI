/** Flat SVG garment illustrations — used for style-quiz looks and for pieces you don't own yet. */
import { COLORS, type ColorName } from "@/lib/taxonomy";

const SHAPES: Record<string, string> = {
  tee: "M30 18 L42 12 Q50 20 58 12 L70 18 L86 32 L76 42 L68 36 L68 88 L32 88 L32 36 L24 42 L14 32 Z",
  longtop: "M30 16 L42 10 Q50 18 58 10 L70 16 L84 54 L90 82 L80 84 L70 52 L68 88 L32 88 L30 52 L20 84 L10 82 L16 54 Z",
  tank: "M36 10 L42 10 Q50 26 58 10 L64 10 L66 30 L70 88 L30 88 L34 30 Z",
  shirt: "M30 16 L42 10 L50 22 L58 10 L70 16 L84 54 L90 82 L80 84 L70 52 L68 88 L32 88 L30 52 L20 84 L10 82 L16 54 Z",
  coat: "M30 12 L42 8 L50 30 L58 8 L70 12 L84 50 L88 92 L78 94 L70 50 L70 96 L30 96 L30 50 L22 94 L12 92 L16 50 Z",
  jacket: "M30 14 L42 10 L50 28 L58 10 L70 14 L84 50 L88 78 L78 80 L70 50 L70 78 L30 78 L30 50 L22 80 L12 78 L16 50 Z",
  trousers: "M30 8 L70 8 L74 94 L56 94 L50 34 L44 94 L26 94 Z",
  shorts: "M28 20 L72 20 L76 66 L54 66 L50 40 L46 66 L24 66 Z",
  skirt: "M34 14 L66 14 L80 78 L20 78 Z",
  dress: "M38 8 L44 8 Q50 18 56 8 L62 8 L64 30 L58 40 L80 92 L20 92 L42 40 L36 30 Z",
  jumpsuit: "M36 8 L44 8 Q50 18 56 8 L64 8 L66 44 L72 94 L56 94 L50 56 L44 94 L28 94 L34 44 Z",
  sneakers: "M14 56 L44 50 Q56 60 72 60 Q86 62 88 72 L88 80 L14 80 Z",
  boots: "M30 16 L54 16 L56 58 Q78 60 86 70 L86 82 L30 82 Z",
  heels: "M16 52 Q40 62 70 58 L84 70 L84 74 L76 74 L74 92 L70 92 L68 74 L22 74 Q14 66 16 52 Z",
  sandals: "M14 70 Q50 58 86 70 L86 78 L14 78 Z M30 70 L40 56 M60 64 L52 56",
  loafers: "M14 60 Q30 52 54 54 Q80 56 88 70 L88 80 L14 80 Z",
  bag: "M24 36 L76 36 L80 86 L20 86 Z M36 36 Q36 16 50 16 Q64 16 64 36",
  hat: "M10 66 Q50 54 90 66 Q90 72 50 72 Q10 72 10 66 Z M30 64 Q30 34 50 34 Q70 34 70 64",
  cap: "M22 64 Q22 30 50 30 Q78 30 78 64 Z M70 62 L94 70 L70 70",
  scarf: "M24 20 L76 20 L76 34 L60 34 L64 90 L50 90 L46 34 L24 34 Z",
  accessory: "M50 20 A30 30 0 1 0 50.1 20 Z",
};

const SUB_TO_SHAPE: Record<string, string> = {
  "t-shirt": "tee", polo: "tee", tank: "tank", "long-sleeve": "longtop", sweater: "longtop", hoodie: "longtop",
  sweatshirt: "longtop", cardigan: "shirt", shirt: "shirt", blouse: "shirt",
  jeans: "trousers", trousers: "trousers", chinos: "trousers", joggers: "trousers", leggings: "trousers",
  shorts: "shorts", skirt: "skirt", dress: "dress", jumpsuit: "jumpsuit",
  jacket: "jacket", "denim-jacket": "jacket", "leather-jacket": "jacket", blazer: "jacket", puffer: "jacket",
  coat: "coat", trench: "coat", raincoat: "coat",
  sneakers: "sneakers", boots: "boots", heels: "heels", sandals: "sandals", loafers: "loafers", "dress-shoes": "loafers", flats: "loafers",
  tote: "bag", crossbody: "bag", backpack: "bag", clutch: "bag",
  hat: "hat", cap: "cap", scarf: "scarf",
};

export function Garment({ sub, color, className = "" }: { sub: string; color: ColorName; className?: string }) {
  const d = SHAPES[SUB_TO_SHAPE[sub] ?? "accessory"];
  const fill = color === "metallic" ? "#c9b37e" : COLORS[color];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d={d} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
