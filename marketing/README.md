# BgadAI marketing kit

| Folder | What | Size / format |
|---|---|---|
| `video/bgadai-promo-9x16.mp4` | Promo for Reels, TikTok, Stories, Shorts | 1080×1920, 46 s, H.264, silent |
| `video/bgadai-promo-16x9.mp4` | Promo for the web, YouTube, Product Hunt, slides | 1920×1080, 46 s, H.264, silent |
| `instagram/bgadai-carousel-1…8.jpg` | Launch carousel + caption, hashtags and alt text (`caption.md`) | 1080×1350 (4:5) |
| `screenshots/` | Real app screens, light (Editorial) and dark (Synth), mobile @2x and desktop @2x, plus `banner.jpg` and a share card | JPEG |

All visuals are **real app screens** captured from the production build with a seeded,
lived-in closet (the bundled MIT-licensed sample photos). Only the weather is a fixed
sample forecast, so shots never show a loading state.

## Design choices (from research)

- **Story order:** hook ("Nothing to wear?") → solution → one feature per beat → proof (two themes, phone & desktop) → call to action.
- **Short headlines** (≤ 6 words), big type, one idea per frame/slide, consistent editorial system (Anybody wide caps, black/white, ✱ accent; Synth purple script for dark moments).
- **Video:** 46 s, hook in the first 3 s, real in-app screens in device frames, captions baked in (most social video plays muted). Two aspect ratios from one timeline.
- **Instagram:** 4:5 (1080×1350) slides, key content inside a 90 px safe margin, slide counter, "Swipe →" on the cover, CTA on the last slide.

## Regenerate everything

```bash
npm run build && npm start   # app on :3000 (or set BASE_URL)
```

```bash
BASE_URL=http://localhost:3000 node marketing/tools/capture.mjs /tmp/bgadai-raw
```

```bash
node marketing/tools/render.mjs /tmp/bgadai-raw marketing/video/bgadai-promo-9x16.mp4 9x16
```

```bash
node marketing/tools/render.mjs /tmp/bgadai-raw marketing/video/bgadai-promo-16x9.mp4 16x9
```

```bash
node marketing/tools/posts.mjs /tmp/bgadai-raw /tmp/bgadai-slides && node marketing/tools/og.mjs /tmp/bgadai-raw
```

Requirements: Playwright with Chromium, and ffmpeg. `render.mjs … --preview 5,12.5` renders
stills at chosen seconds to check a layout before encoding. The timeline lives in
`tools/promo.html` (`window.renderAt(t)`), slides in `tools/posts.html`.
