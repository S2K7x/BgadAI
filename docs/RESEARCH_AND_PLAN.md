# BgadAI — Research & Product/Technical Plan

> AI wardrobe stylist: photograph your clothes, tell the app your style, and get outfits built
> from what you already own — plus "recreate this look" from inspiration photos and
> "shop the gap" suggestions for missing pieces.

Research date: November 2026. Many feature claims below come from vendor pages, app-store
listings and competitor comparison pages; treat them as self-reported and re-check before
relying on them.

---

## 1. Competitive landscape

| App | What it's known for | Ideas worth taking |
|---|---|---|
| **Whering** | Most popular free digital wardrobe; "Dress Me" AI outfit shuffle; calendar; cost-per-wear analytics; paid AI credits | Shuffle-style "Dress Me" button, outfit calendar with OOTD selfies, cost-per-wear |
| **Alta** | AI stylist + **look-alike avatar try-on**; outfits from wardrobe, weather, occasion, budget; free app monetised by **affiliate commissions**; $11M seed (Menlo) | Avatar try-on (later phase), affiliate model, budget-aware shopping |
| **Acloset** | AI auto-tagging, outfit recs from location/time/day/weather, AI stylist chat, social feed, pre-loved marketplace; 100 items free | Context-aware daily outfit, stylist chat, resale of unworn items |
| **Indyx** | Auto background removal; **import via forwarded email receipts & product links**; cost-per-wear; human stylists | Fast bulk import (biggest onboarding pain is ~2 min/item), insights |
| **GetWardrobe** | Very broad feature set: add from URL/screenshot, product detection, AI outfit generator with compatibility scores, swipe through combinations, try-on, capsules, packing lists, weather, calendar, community, stylist mode, export, MCP connectors for Claude/ChatGPT | "Explore combinations" swipe UI, packing lists, capsule builder, data export, AI-assistant connector |
| **Stylebook** | iOS-only, one-time purchase, mostly manual | Shows there's demand for privacy/no-subscription; but manual entry is the main complaint |
| **Cladwell** | Capsule-wardrobe focus, outfit tracking, low price | Capsule wardrobe mode |
| **Stitch Fix** (not a wardrobe app, but best-in-class onboarding) | Style quiz (size, fit, lifestyle, budget) + **Style Shuffle** swipe left/right on outfits; profile shown as "top style dimensions" / style personality | The onboarding pattern we should copy (see §3) |
| **Wardrowbe** (open source, MIT) | Self-hosted; photo → AI tags; daily outfit via weather/occasion; wear tracking & ratings; analytics; family profiles | Good reference architecture (see §5) |

Recurring user complaints across reviews/comparisons:

1. **Adding clothes takes too long** → the #1 reason people abandon these apps.
2. **Auto-tags that don't map to filters** (e.g. detected colours not usable in the colour filter).
3. **AI outfits that don't solve "nothing to wear"** — generic combinations, ignoring weather/occasion/what you actually like.
4. **Visually busy UI.**
5. **Slow avatar generation / try-on that ignores real measurements** (Alta reviews).

Our differentiators should directly attack these: fastest possible import, a style profile that
actually steers results, explainable outfits, and a "recreate this look" flow that most
competitors don't do well.

---

## 2. Feature list (prioritised)

### MVP (v0.1) — "my closet, my outfits"
- **Style onboarding** (quiz + swipe, ~2 min, skippable; §3).
- **Add clothes fast**
  - Multi-photo upload / camera capture.
  - Automatic background removal + auto-crop.
  - AI auto-tagging into a **fixed taxonomy** (category, sub-category, colours, pattern, material, formality, warmth, seasons, style tags) — user can correct in one tap.
  - **Flat-lay mode**: one photo of several items on the bed/floor → split into separate items.
- **Closet view**: grid with filters (category, colour, season, occasion), search.
- **AI outfit generator**: "Dress me" for today (weather + occasion), with a one-line *why* for each outfit; swap a single piece; regenerate.
- **Manual outfit builder**: drag-and-drop canvas / slot picker (top, bottom, shoes, outer, accessories).
- **Feedback**: 👍 / 👎 / "wore it" on outfits — feeds personalisation.
- **Weather** (Open-Meteo, free, no key).

### v0.2 — "recreate the look" + shopping
- **Inspiration board**: upload outfit photos / screenshots (Pinterest, Instagram, street style).
- **Recreate from my closet**: detect each garment in the inspo photo → find the closest item you own per slot → show a match score per piece.
- **Shop the gap**: for pieces you don't own, search the web for similar products (visual search + affiliate feeds), filtered by budget & size.
- **Add from URL / screenshot**: paste a product link → pull image, brand, price.
- **Outfit calendar**: plan ahead, log what you wore (+ OOTD selfie).

### v0.3 — insights & planning
- Wear tracking, **cost-per-wear**, "never worn" list, colour distribution, wardrobe value.
- **Capsule wardrobe** builder & **packing lists** for trips (weather at destination).
- **AI stylist chat** ("what goes with my green blazer?", "date night, it's 8°C").
- "Gap analysis": which 3 items would unlock the most new outfits.

### Later
- **Virtual try-on** on the user's photo/avatar (paid credits; §4.6).
- Email-receipt import (forwarding address).
- Social: share outfits, follow friends, get votes ("which one?").
- Resale/declutter suggestions for items unused for 6+ months.
- MCP connector so users can ask Claude/ChatGPT about their wardrobe.
- Family / multiple profiles; stylist-client mode.
- Native app shell (Capacitor or Expo) if PWA camera limits bite.

---

## 3. UX — what makes these apps feel good

**Time-to-first-value is everything.** Don't make users catalogue 80 items before they see an outfit.

1. **Onboarding in three short steps** (all skippable, progress bar):
   1. *Basics*: gender presentation of clothes shown, climate/city, lifestyle (office / casual / student / active), budget range, sizes (optional), colours/fits you avoid.
   2. *Style Shuffle*: swipe ~20–30 outfit images that span aesthetics (minimal, streetwear, classic, boho, sporty, preppy, edgy, romantic…). Stitch Fix found swipes add depth beyond the quiz alone.
   3. *Result*: show the user's **top 3 style archetypes** as a visual card ("Modern Minimal 45% · Street 30% · Classic 25%") they can adjust with sliders. This is shareable and makes the profile feel real.
2. **"Add 5 items, get your first outfit"** — a guided quick-start right after onboarding (one top, one bottom, shoes, one layer, one extra). Then outfits immediately.
3. **Capture flow**: camera opens directly; shoot many items in a row; processing happens in the background with a progress tray — never block the user on AI.
4. **Correct, don't fill**: show AI tags as pre-filled chips; editing is optional and one-tap.
5. **Explain every outfit** ("Navy + camel is a classic pairing; trainers keep it casual for your 'weekend' occasion; 14°C so we added the denim jacket"). Builds trust and teaches style.
6. **Swap, don't regenerate**: tap any piece to cycle alternatives that still fit the outfit.
7. **Calm, image-first UI**: white/neutral canvas, clothes as cut-outs, minimal chrome (the "too busy" complaint about Whering).
8. **Swipe to rate suggestions** (Tinder-style deck of outfits) — fun, and great training data.
9. **Mobile-first, thumb-reachable** bottom nav: *Today · Closet · Create · Inspo · Profile*.

---

## 4. How to build the AI parts

### 4.1 Image ingestion pipeline
```
photo ──► client: resize to ~1024px, WebP/JPEG, strip EXIF/GPS
      ──► upload to object storage (signed URL, direct from browser)
      ──► background job:
            1. background removal + auto-crop
            2. (flat-lay) detect & split into multiple items
            3. vision-LLM tagging → strict JSON (taxonomy enums)
            4. image embedding (FashionCLIP) → pgvector
            5. thumbnails (256px) for the grid
      ──► realtime update to the client ("3 of 7 items ready")
```

- **Background removal options**
  - Server: `rembg` (U²-Net, MIT) or **BiRefNet** (MIT) — better edges on clothing.
  - Client-side (free, private): Transformers.js + WebGPU running BRIA **RMBG-1.4** ~2–5 s/image with WASM fallback. ⚠️ RMBG's licence restricts commercial use without an agreement with BRIA — fine for prototyping, check before launch.
  - Hosted API (remove.bg / Photoroom) if you want zero ops.
- **Garment detection / segmentation** (flat-lay split and inspiration photos)
  - `mattmdjaga/segformer_b2_clothes` — clothing parsing (upper, skirt, pants, dress, shoes, bag…).
  - Grounding DINO + SAM/SAM2 for text-prompted detection ("jacket", "sneakers") with precise masks.
  - Simplest start: ask a vision LLM for bounding boxes + descriptions, then crop.
- **Tagging**: one call to a small, cheap vision model with a JSON schema whose fields are **enums that match your filters exactly** (lesson from the colour-tag complaint). Store a confidence; low-confidence fields get highlighted for the user to confirm.

### 4.2 Data model (Postgres + pgvector)
```sql
users(id, ...)
style_profiles(user_id, archetype_weights jsonb, style_vector vector(512),
               climate, lifestyle, budget_min, budget_max, avoid jsonb, sizes jsonb)
items(id, user_id, image_url, cutout_url, thumb_url,
      category, subcategory, colors text[], pattern, material,
      formality smallint,  -- 1 (lounge) … 5 (black tie)
      warmth smallint,     -- 1 … 5
      seasons text[], style_tags text[], brand, price, purchased_at,
      embedding vector(512), wear_count int, last_worn_at, status)
outfits(id, user_id, source /*ai|manual|inspo*/, occasion, explanation,
        score real, created_at)
outfit_items(outfit_id, item_id, slot /*top|bottom|onepiece|shoes|outer|accessory*/)
outfit_feedback(outfit_id, user_id, rating smallint, worn_on date)
inspirations(id, user_id, image_url, detected jsonb)
inspiration_matches(inspiration_id, slot, item_id null, score, shop_results jsonb)
swipes(user_id, image_id, liked bool)   -- onboarding Style Shuffle
```
Use HNSW indexes on `embedding`; always filter by `user_id` (row-level security).

### 4.3 Outfit generation — hybrid, not "ask the LLM"
Sending the whole closet to an LLM each time is slow, expensive and hallucination-prone
(it invents items). Research systems (e.g. *Loom*, 2026; hybrid CLIP+transformer models)
and the Polyvore literature all converge on **retrieve → constrain → score → explain**:

1. **Templates/slots**: `top+bottom+shoes`, `onepiece+shoes`, `+outer` if cold/rain, `+accessory` optional.
2. **Hard constraints** (SQL filters): weather → warmth & season; occasion → formality range; exclude items in the laundry / worn yesterday; respect "avoid" list.
3. **Candidate generation**: pick an anchor item (rotate under-worn items to boost variety), then retrieve compatible items per slot via pgvector nearest-neighbour + filters.
4. **Scoring** (cheap, deterministic, explainable):
   - colour harmony (neutrals, complementary/analogous rules on HSL),
   - formality coherence (spread ≤ 1),
   - embedding compatibility (similar ≠ compatible — Vasileva et al. 2018; start with CLIP similarity, later train a small compatibility head on user feedback),
   - style-profile match (cosine to the user's style vector),
   - novelty / rotation (penalise recently-worn combos).
5. **LLM re-rank + explain** the top ~10 candidates (send compact text descriptions, not images) → return 3–5 outfits with a one-line rationale. Validate that every returned item id exists.
6. **Learning loop**: 👍/👎/wore-it/swaps update per-user weights and the style vector; later a learned ranker.

Bonus: precompute "Today's outfits" for each user in a nightly/early-morning job so the home screen opens instantly.

### 4.4 Style profile
- Style vector = mean(FashionCLIP embedding of liked swipe images) − λ·mean(disliked), normalised.
- Archetype weights = similarity of style vector to text-embedded archetype prompts ("minimalist neutral tailored outfit", "streetwear oversized hoodie sneakers"…).
- Keep updating it from saved/liked outfits and inspiration uploads.

### 4.5 "Recreate this look" & "Shop the gap"
1. Detect garments in the inspo photo (§4.1) → crop each → embed + tag.
2. For each slot, nearest-neighbour search in the user's closet with category filter → score.
3. Score ≥ threshold → "You own this ✓"; otherwise → "Missing piece".
4. **Shop the gap** options:
   - **Visual search**: Google has no official Lens API; SerpApi's Google Lens endpoint returns visual/product matches (paid, ~100 free searches/month). Unofficial scrapers exist but break and may violate ToS — avoid in production.
   - **Text search**: build a query from tags ("camel wool wrap coat women") → shopping search API.
   - **Affiliate catalogues** (ShopStyle Collective, Rakuten, Skimlinks, Amazon, Awin): ingest product feeds, embed product images into your own pgvector index → true visual similarity + affiliate revenue (Alta's model). Best long-term option.
   - Filter by user budget/size; show "would unlock N new outfits with your closet".

### 4.6 Virtual try-on (later, paid credits)
- Commercial APIs: FASHN (~$0.075/image reported), Kling Kolors try-on via fal (~$0.07), Google Vertex AI Virtual Try-On (GA Jan 2026).
- ⚠️ IDM-VTON is CC BY-NC-SA (non-commercial) — research only.
- User body photos are sensitive: explicit consent, private bucket, easy deletion.

### 4.7 Model choice (keep it provider-agnostic)
- Wrap AI calls behind one interface (tagging, explain/rerank, chat) so models can be swapped.
- Small/fast vision model (e.g. Claude Haiku-class) for tagging — high volume, low cost.
- Stronger model (e.g. Claude Sonnet-class) for stylist chat and outfit explanations.
- Use structured outputs / JSON schema, prompt caching for the static system prompt + taxonomy, and batch APIs for bulk re-tagging.
- Embeddings: FashionCLIP (open, 512-d) self-hosted or via a hosted inference endpoint; generic multimodal embedding APIs work as a fallback.

---

## 5. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, installable **PWA** | One codebase for web + phone; fastest iteration. Camera via `<input capture>` / `getUserMedia` is enough for the MVP. Wrap with Capacitor (or port to Expo) later if native camera/offline needs grow. |
| State/data | TanStack Query, optimistic updates | Snappy UI while AI jobs run |
| Backend/DB | **Supabase**: Postgres + **pgvector**, Auth, Storage, Realtime, Row-Level Security | One managed service covers DB, vectors, auth, files, live job progress |
| Jobs | Supabase Queues / Edge Functions, or Inngest / Trigger.dev | Background removal, tagging, embeddings, nightly outfit precompute |
| ML service | Small Python (FastAPI) container for rembg/BiRefNet, SegFormer, FashionCLIP — or hosted inference (Replicate / fal / Hugging Face endpoints) | Keep heavy models out of the web tier |
| Weather | Open-Meteo (free, no key) | Used by Wardrowbe & others |
| Images | CDN with on-the-fly resizing (Supabase image transforms / Cloudflare Images) | Grid loads thumbnails, detail loads full size |
| Hosting | Vercel (web) + Supabase + a GPU-less container (Fly/Render) for CPU models | Cheap to start |

Reference architecture: the open-source **Wardrowbe** (Next.js + FastAPI + Postgres + Redis/arq
worker + rembg + Open-Meteo, OpenAI-compatible model API) is very close to this and worth reading.

---

## 6. Performance & cost optimisation checklist
- **Resize + compress on the client** before upload (saves bandwidth, storage, model tokens).
- Upload **directly to storage** with signed URLs; never stream images through your API server.
- Every AI step is **async** in a queue with retries; UI shows progress via realtime.
- **Cache embeddings & tags** forever (re-run only when the model version changes; store `model_version`).
- Outfit generation is mostly **SQL + vector search + arithmetic** — LLM only for the final top-10 rerank/explanation → cents per thousand outfits instead of dollars.
- **Precompute** daily outfits; cache shop-the-gap results per item for 24–72 h.
- Virtualised, lazy-loaded closet grid with 256px thumbnails and blur placeholders.
- Per-user rate limits / **AI credits** on expensive features (try-on, web shopping search).
- HNSW index on vectors, always pre-filtered by `user_id` + category.
- Strip EXIF/GPS from photos for privacy; private buckets + RLS on everything.

---

## 7. Monetisation (what the market does)
- **Freemium** with item cap or AI credits (Acloset: 100 items free; Whering/GetWardrobe: credits).
- **Affiliate commissions** on shop-the-gap (Alta's whole model — keeps the app free).
- Premium subscription: unlimited AI outfits, try-on credits, travel/capsule planner, advanced stats.

---

## 8. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Setup (week 1) | Next.js PWA skeleton, Supabase project, auth, storage, schema, CI | Login + upload a photo |
| 1. Closet (weeks 2–3) | Capture, bg removal, tagging, embeddings, closet grid & filters | 20 items added in < 5 min |
| 2. Onboarding (week 4) | Quiz + Style Shuffle + archetype card | Style vector stored |
| 3. Outfits (weeks 5–6) | Hybrid generator, weather, explanations, swap, manual builder, feedback | Users 👍 ≥ 50% of suggestions |
| 4. Inspo (weeks 7–8) | Inspo upload, garment detection, closet matching | Look recreated with per-piece scores |
| 5. Shopping (weeks 9–10) | Shop-the-gap (visual search + affiliate feed), add-from-URL | Similar products shown for missing pieces |
| 6. Insights & polish | Calendar, wear tracking, cost-per-wear, capsules, packing | — |
| 7. Try-on & social | Paid try-on credits, sharing | — |

---

## 9. Sources
Competitors & features
- [Whering vs Indyx (Indyx)](https://myindyx.com/versus/whering-vs-indyx) · [Acloset vs Whering](https://www.myindyx.com/versus/acloset-vs-whering) · [Stylebook vs Indyx](https://myindyx.com/versus/indyx-vs-stylebook)
- [Wardrobe app comparison chart 2026 (Wardrowbe)](https://wardrowbe-landing.pages.dev/blog/wardrobe-app-comparison-chart-2026/) · [GetWardrobe compare](https://getwardrobe.com/compare/) · [GetWardrobe vs Whering](https://getwardrobe.com/compare/whering/) · [GetWardrobe features](https://help.getwardrobe.com/latest/features/)
- [Can you really organize your closet with an app? (Stacker)](https://stacker.com/stories/home-garden/can-you-really-organize-your-closet-app-how-tell-if-its-worth-your-time-set-one)
- [Whering App Store](https://apps.apple.com/dk/app/id1519461680) · [Whering: reasons to track what you wear](https://whering.co.uk/thoughts/six-reasons-to-track-your-outfits) · [Whering best wardrobe apps](https://whering.co.uk/best-wardrobe-apps-2024) · [Whering profile (stork.ai)](https://www.stork.ai/en/whering-2)
- [Alta App Store](https://apps.apple.com/gb/app/id6481705400) · [Alta avatars](https://www.altadaily.com/blog/virtual-dressing-room) · [Alta $11M seed (FashionUnited)](https://fashionunited.uk/news/business/alta-raises-11-million-in-seed-funding-for-ai-powered-personal-shopping-styling-app/2025061782265) · [TechCrunch on Alta](https://techcrunch.com/?p=3017882)
- [Acloset support](https://www.acloset.app/support/) · [Acloset 6.30 announcement](https://www.acloset.app/announcements/6-30-0-1785377094985/) · [Acloset on ScreensDesign](https://screensdesign.com/showcase/acloset-ai-fashion-assistant)
- [Indyx App Store](https://apps.apple.com/us/app/-/id1599179405) · [GetWardrobe vs Indyx](https://getwardrobe.com/compare/indyx/)
- [Best AI outfit generators 2026 (fast.io)](https://fast.io/resources/best-ai-outfit-generators-2026/) · [Best AI stylists 2026 (Fits)](https://fits-app.com/posts/best-ai-stylists-in-2025-top-5-free-paid-services) · [Toolworthy roundup](https://www.toolworthy.ai/blog/best-ai-outfit-generator)
- [Stitch Fix how it works](https://www.stitchfix.com/how-it-works) · [Stitch Fix style profile guide](https://stitchfix.com/men/blog/?p=122) · [My Subscription Addiction review](https://www.mysubscriptionaddiction.com/2024/10/shopping-just-got-very-personal-why-stitchfix-is-now-my-go-to-stylist.html)

Open source
- [Wardrowbe (GitHub)](https://github.com/Anyesh/wardrowbe) · [Snazzy Closet / fashion-recommender](https://awesome.ecosyste.ms/projects/github.com%2Fatxtechbro%2Ffashion-recommender) · [StyleBot](https://github.com/angieguia/StyleBot) · [OutfitAI Studio](https://github.com/rishabh55122/outfit)

Research & ML
- [Hybrid multimodal fashion recommendation (arXiv 2511.07573)](https://arxiv.org/abs/2511.07573v2) · [TrendGen (arXiv 2603.27264)](https://arxiv.org/pdf/2603.27264) · [Loom (arXiv 2605.09830)](https://arxiv.org/pdf/2605.09830) · [Type-aware compatibility embeddings (arXiv 1803.09196)](https://arxiv.org/abs/1803.09196)
- [Fashion detection survey (arXiv 2404.08582)](https://arxiv.org/pdf/2404.08582v1.pdf) · [SegFormer clothes shop-the-look demo](https://huggingface.co/spaces/aparnak1/stl/raw/718b08a86381b23dd8ae41f9463f8c30af2da73a/app.py) · [Grounded SAM (Replicate)](https://replicate.com/schananas/grounded_sam) · [Roboflow outfit workflow](https://blog.roboflow.com/transforming-outfits-with-roboflow-workflows/)
- [In-browser background removal (Backblaze sample)](https://github.com/backblaze-b2-samples/b2-transformerjs-background-removal) · [remove-bg WebGPU](https://github.com/ducan-ne/remove-bg) · [WebNN remove-background space](https://huggingface.co/spaces/webnn/remove-background/blob/main/index.html)

APIs & infrastructure
- [SerpApi Google Lens app tutorial](https://serpapi.com/blog/building-an-image-based-search-app-with-google-lens-api/) · [chrome-lens-search](https://pypi.org/project/chrome-lens-search/) · [ShopStyle API client](https://pypi.org/project/shopstyle-api)
- [Best virtual try-on APIs 2026 (fal)](https://fal.ai/learn/tools/best-virtual-try-on-apis-2026) · [Virtual try-on APIs for developers 2026](https://innvesti-landing.pages.dev/reports/best-virtual-try-on-apis-developers-2026/)
- [Supabase vector search with Next.js](https://supabase.com/docs/guides/ai/examples/nextjs-vector-search)
- [PWA vs Native vs React Native 2026](https://www.buildmvpfast.com/blog/pwa-vs-native-vs-react-native-solo-founder-decision-2026) · [React Native vs Expo 2026](https://www.markaicode.com/vs/react-native-vs-expo/)

---

## 10. Implementation status (v0.1 — built)

The first version is **local-first** rather than Supabase-backed: no account, zero setup, and
photos stay on the device. The data model in §4.2 maps 1:1 onto the IndexedDB tables
(`src/lib/db.ts`), so syncing to Supabase/Postgres later is an additive change.

| Plan item | Status |
|---|---|
| Style onboarding (quiz + Style Shuffle swipe + archetype card) | ✅ `src/app/onboarding` |
| Multi-photo capture, resize/EXIF strip, background queue | ✅ `src/app/closet/add`, `src/lib/image.ts` |
| AI tagging into a fixed taxonomy (structured outputs) | ✅ `POST /api/ai/analyze` |
| Flat-lay mode (one photo → several items, cropped by box) | ✅ |
| On-device colour extraction (k-means → palette names) | ✅ works without AI |
| Background removal | ⚠️ Experimental on-device (see learnings) |
| Closet grid, filters (category / colour / search), laundry status, item details, price | ✅ |
| Hybrid outfit engine (constraints → scoring → MMR diversity → explanations) | ✅ `src/lib/outfitEngine.ts` + tests |
| Weather (Open-Meteo), occasions, swap a piece, 👍/👎 learning, "style this item" | ✅ |
| LLM re-rank + explanations of top candidates | ✅ `POST /api/ai/stylist` (on demand) |
| Manual builder with live score + "complete it for me" | ✅ `src/app/create` |
| Inspiration → garment breakdown → closet matching → shop the gap | ✅ `src/app/inspo`, `POST /api/ai/inspo`, `GET /api/shop` |
| Wear log, cost-per-wear, never-worn, colour palette insights | ✅ `src/app/me` |
| Backup export/import | ✅ |
| PWA manifest + icons | ✅ (offline service worker: not yet) |

### Learnings from building & testing
- **BiRefNet lite in the browser is fragile.** The ONNX export only ships `fp32`/`fp16` weights
  (no quantised variants); `fp16` needs the WebGPU `shader-f16` feature; the WebGPU kernels
  need >10 storage buffers per shader stage (fails on SwiftShader and likely on low-end phones);
  and the WASM fallback runs out of memory at 1024×1024. The app therefore verifies the model
  with a test cut-out before enabling it. **Next step:** a server-side cut-out worker
  (rembg/BiRefNet, MIT) or a hosted API, used when on-device fails.
- **Next.js 16 keeps previously visited routes mounted** (hidden) for instant back-navigation —
  helpful for UX, but remember it when writing tests or global listeners.
- The SDK auto-adds the structured-outputs beta when `output_config.format` is used; refusals are
  routed server-side to a fallback model with `fallbacks: "default"`.

### Next up (from the roadmap)
1. Server-side background removal fallback.
2. Optional accounts + Supabase sync (multi-device), with RLS.
3. FashionCLIP embeddings (pgvector) for visual similarity in inspo matching and swap ranking.
4. Affiliate product feeds for shop-the-gap; budget/size filters.
5. Outfit calendar view, capsule & packing lists, AI stylist chat.
6. Offline service worker; virtual try-on (paid credits).
