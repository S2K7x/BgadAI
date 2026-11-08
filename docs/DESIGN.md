# BgadAI design system

The UI adapts two fashion e-commerce references into two switchable themes that share one set of
components and tokens:

| | **Editorial** (light) | **Synth** (dark) |
|---|---|---|
| Reference | Monochrome editorial storefront ("Almina") | Dark streetwear drop page ("Synth Era") |
| Display type | Anybody, width **150%**, weight 800, uppercase | Anybody, width **62%**, weight 750, uppercase |
| Accent line | Wide caps, black | Rock Salt handwriting, purple `#a874ff` |
| Shapes | Square buttons/chips, **cut-corner** photo tiles | 12 px buttons, 22 px glass panels, rounded tiles |
| Hero wordmark | Solid black, **inverts** over photos (`mix-blend-mode: difference`) | Metallic gradient **behind** the floating garment |
| Decoration | ✱ asterisk | Soft purple corner glow |
| Primary button | Black / white text | Off-white / dark text |

Switch in **Me → Appearance** or with the header toggle; "Auto" follows the device.

## How it's built (and why it's fast)

- **One display font for both themes.** [Anybody](https://fonts.google.com/specimen/Anybody) is a
  variable font with a width axis from 50 to 150 (~57 KB latin). `next/font` self-hosts it at build
  time with `axes: ["wdth"]`; each theme just sets `font-stretch`. The handwriting accent (Rock
  Salt, ~59 KB) uses `preload: false`, so the browser only downloads it when Synth text renders.
- **No theme flash.** An inline script in `<head>` (see `src/app/layout.tsx`) applies the saved theme
  as `data-theme` before first paint, per the Next.js guide
  `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`. The page
  stays statically prerendered (no cookies read on the server). CSS also falls back to
  `prefers-color-scheme` if JavaScript is off.
- **Tokens, not per-component theming.** `src/app/globals.css` defines colours, radii
  (`rounded-card / -tile / -btn`), the tile clip-path and type settings as CSS variables; Tailwind v4
  `@theme inline` exposes them as utilities, and `@custom-variant dark` targets `[data-theme=dark]`.
- **CSS-only effects.**
  - Cut corners are a 5-point `clip-path: polygon()`, cheap to composite.
  - The inverting wordmark uses `mix-blend-mode` on its own positioned layer (a stacking
    context), so it blends with the photos underneath.
  - The wordmark size uses container-query units (`cqw`) so any word fills the width without JS.
  - The only `backdrop-filter` is a 12 px blur on the bottom nav, and it's turned off under
    `prefers-reduced-transparency`.
  - The glow is a fixed radial gradient, not a blur.
- **Long lists.** Closet tiles use `content-visibility: auto` and lazy, async-decoded images.
- **Motion** (float, pop-in) is disabled under `prefers-reduced-motion`.

## Building blocks (`src/components`)

- `Hero`: giant wordmark + tilted/floating garments + accent line + side info card.
- `ui.tsx`: `PageHeader` (huge title + accent), `SectionTitle`, `Stats` (big-number row), `Chip`
  (filter tags), `Button`, `Card`, `Sheet`, `Asterisk`, `Meter`.
- `ItemImage`: photo tile (cut-corner / rounded per theme).

## Research notes
- Free stand-ins for the paid faces in the references: Monument Extended / Druk → Anybody at
  different widths; the "Created for you." script → Rock Salt. Compared side by side before
  choosing.
- 2026 editorial fashion storefronts lean on extreme type-scale contrast and restrained
  monochrome palettes. Keep the clothing photos in full colour, since colour matters for styling.
- Blur effects are the main mobile scroll-jank risk (several open browser bugs), so use them
  sparingly.
