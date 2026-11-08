# BgadAI — your AI stylist

A mobile-first web app (installable PWA) that builds outfits from **your own clothes**, tuned to
**your style**, the **weather** and the **occasion**.

- 📸 **Add clothes fast** — snap or pick many photos at once; AI tags type, colours, pattern,
  formality, warmth, seasons and style. **Flat-lay mode** splits one photo of several items into
  separate pieces. Optional on-device background removal.
- 🧭 **Style onboarding** — a short quiz plus a swipeable "Style Shuffle" deck produces your
  style mix (e.g. *Modern Minimal 52% · Classic 34% · Preppy 8%*), adjustable any time.
- ✨ **Today** — weather-aware outfits for the occasion you pick, each with a *why*, a match
  score breakdown, tap-to-swap any piece, 👍/👎 learning, "wear today" logging and optional
  AI stylist picks. "Style this" builds outfits around one item.
- 🧩 **Create** — build your own looks with live scoring ("navy and camel are both neutrals…"),
  or let it **complete the outfit for you**; save and favourite looks.
- 🖼️ **Inspiration** — upload a look you love: it's broken down into pieces, matched against
  your closet ("2/3 pieces found"), and missing pieces get **shop-similar** results and links
  (Google Shopping, Vinted second-hand, Pinterest).
- 📊 **Me** — style profile, wear stats, cost-per-wear, never-worn list, colour palette,
  preferences, and JSON backup/restore.
- 🔒 **Local-first** — your closet lives in the browser (IndexedDB). Photos are sent to the AI only
  when you analyse them and are never stored server-side.

- 🎨 **Two looks** — *Editorial* (monochrome, ultra-wide type, cut-corner tiles) and *Synth*
  (dark streetwear, condensed type, purple handwriting). See **[docs/DESIGN.md](docs/DESIGN.md)**.

See **[docs/RESEARCH_AND_PLAN.md](docs/RESEARCH_AND_PLAN.md)** for the competitive research
(Whering, Alta, Acloset, Indyx, GetWardrobe, Stitch Fix…), UX principles and the roadmap.

## Run it

```bash
npm install
```

```bash
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY / SERPAPI_API_KEY
```

```bash
npm run dev
```

Open http://localhost:3000 (use your phone's browser on the same network, or "Add to Home Screen"
for the app experience).

Without any keys the app still works: colours are detected on-device, you choose the item type,
and the rules-based outfit engine does all styling. With `ANTHROPIC_API_KEY` you get AI tagging,
flat-lay splitting, inspiration breakdown and stylist picks.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (outfit engine, colour harmony, matching, style profile) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## How it works

```
Browser (Next.js PWA, all UI client-side)
 ├─ IndexedDB (Dexie): items + photos, outfits, wear log, feedback, inspirations, profile
 ├─ Image pipeline: resize/compress (strips EXIF/GPS) → crop → optional BiRefNet cut-out
 │                  (Transformers.js, WebGPU) → k-means colour extraction → palette names
 ├─ Outfit engine (src/lib/outfitEngine.ts) — deterministic, on-device:
 │     retrieve → hard constraints (weather, formality) → score (colour harmony, occasion,
 │     weather layering, style match, freshness/rotation, learned feedback) → diversify (MMR)
 │     → explain
 └─ Open-Meteo weather + geocoding (free, no key)

Next.js route handlers (server, holds the keys)
 ├─ POST /api/ai/analyze   photo → structured tags (+ boxes for flat lays)
 ├─ POST /api/ai/inspo     inspiration photo → garment list
 ├─ POST /api/ai/stylist   pre-scored candidates → best picks + explanations
 └─ GET  /api/shop         SerpApi Google Shopping (optional)
```

Design choices that matter:

- **The LLM never sees the whole closet and never invents items.** Outfits are assembled and
  scored on-device; the AI only re-ranks/explains a short candidate list, and returned ids are
  validated.
- **Fixed taxonomy.** AI output is constrained (structured outputs) to the exact enums the
  filters use, then sanitised server-side (e.g. a subcategory that doesn't match the category is
  corrected).
- **Fast import.** Multi-photo upload, background processing queue, flat-lay splitting, and a
  guided "add 5 pieces" quick start — slow cataloguing is the #1 reason people abandon these apps.

### Background removal

On-device cut-outs use BiRefNet lite (MIT) via Transformers.js from a CDN. It needs WebGPU with
enough storage buffers per shader stage; turning the setting on downloads the model and runs a
test cut-out, and switches itself back off with an explanation if the device can't run it.
Photos then keep their background (a plain wall or bedsheet behind clothes works well). A
server-side option (e.g. `rembg` / BiRefNet in a Python worker) is on the roadmap.

## Project layout

```
src/app/            pages: / (Today), onboarding, closet, closet/add, create, inspo, me; api/*
src/components/     AppShell (nav), OutfitBoard, TagEditor, Garment (SVG), ui primitives
src/lib/            taxonomy, outfitEngine, colors, matching, style, weather, image, db, ai/*
src/lib/__tests__/  unit tests
docs/               research & plan
```
