# `new_style.md` — Design System of `/new-home`

> Reverse-engineered **1:1 from the live rendered page** at `http://localhost:3001/new-home`.
> Every value below was read out of the browser (computed styles, CSS custom properties, DOM
> structure and the page's own motion timeline) — nothing here is inferred from other routes.
>
> **Scope note:** this page is a self-contained, hard-scoped theme. Everything lives under a
> single root element `.nh-root`, and every rule is namespaced `nh-*` (BEM-ish:
> `block__element--modifier`). It deliberately shares **nothing** with the rest of the storefront
> theme — different surfaces, different ink, different typeface, and it does **not** use the
> storefront's signature gold `#cebd63` anywhere. Flipping the palette is a matter of swapping the
> one token block on `.nh-root`; nothing below that block hardcodes a colour literal.

---

> ## ⚠️ HOW TO USE THIS FILE
>
> **Colour, type, spacing and component structure (§2–§5, §7–§10)** describe the page as it is —
> read them whenever you need to match the look.
>
> **Motion (§6) and the animation recipe library (§11) are OPT-IN.**
> Do **not** apply any of the scroll-linked transforms, blind reveals, character-split headlines,
> pinned card stacks or staggered entrances to any other page or component **unless the user
> explicitly asks for them.** They are documented here exactly so they *can* be reproduced on
> request — not so they get sprinkled around by default. A page built from this file with the
> motion section ignored is a correct and complete result.
>
> When the user does ask ("add the new-home animations", "make it animate like /new-home",
> "use the blinds reveal", "give it the hero load sequence"), §6 is the spec and §11 is the
> copy-paste source.

---

## 1. Identity at a glance

| Property | Value |
| --- | --- |
| Route | `/new-home` |
| Root element | `div.nh-root` |
| Page title | `Iced_out — Gear up every season, every workout — Iced_out` |
| `<h1>` | `GEAR UP EVERY SEASON / EVERY WORKOUT!` |
| Meta description | *Performance-driven training wear built for summer heat and winter cold.* |
| Theme | Dark, cool-cast (blue-grey), near-monochrome |
| Typeface | **Archivo** variable (`wght 100–900`, `wdth 62%–125%`) |
| Total scroll height | ~8156px at 1400×672 (the pinned showcase alone is `500svh`) |
| Mood | Editorial fashion / performance-sportswear. Oversized outline type, cut-out subject, frosted glass chips, blind-reveal photography |

**Root declaration**

```css
.nh-root {
  background: var(--nh-surface);      /* #101113 */
  color: var(--nh-ink);               /* #f1f3f3 */
  font-family: var(--font-archivo), "Archivo", system-ui, sans-serif;
  letter-spacing: -0.01em;
  overflow-x: clip;                   /* clip — NEVER hidden (see §9) */
  min-height: 100vh;
}
.nh-root *, .nh-root *::before, .nh-root *::after { box-sizing: border-box; }
```

---

## 2. COLOR SYSTEM — the complete palette

All 26 colour tokens are declared on `.nh-root`. This is the page's entire colour vocabulary.

### 2.1 Surfaces — the dark stack

| Token | Hex | RGB | Used for |
| --- | --- | --- | --- |
| `--nh-surface` | `#101113` | `16, 17, 19` | **The page.** Base background of `.nh-root`, every `.nh-section`, `.nh-showcase`. Also the terminal stop of the pick-card fade. |
| `--nh-surface-2` | `#16181a` | `22, 24, 26` | Secondary surface (the chip background is this colour at 72% alpha) |
| `--nh-surface-3` | `#0a0b0c` | `10, 11, 12` | **Deepest.** Footer background and the video-card well |
| `--nh-card-bg` | `#1a1c1e` | `26, 28, 30` | Placeholder fill behind every media card — editorial frames, pick cards, product tiles |
| `--nh-nav-plate` | `#0f1214` | `15, 18, 20` | The notched navbar plate. Sits one step **darker** than `--nh-hero-top` so the notched silhouette stays visible against the hero glow |
| `--nh-ring` | `#151b1e` | `21, 27, 30` | 2px ring around the stacked avatars |

### 2.2 Hero gradient — the cool cast

| Token | Hex | RGB | Position |
| --- | --- | --- | --- |
| `--nh-hero-top` | `#171e22` | `23, 30, 34` | Linear gradient `0%` |
| `--nh-hero-mid` | `#131719` | `19, 23, 25` | Linear gradient `46%` |
| `--nh-hero-bot` | `#0e0f11` | `14, 15, 17` | Linear gradient `100%` |
| `--nh-hero-glow` | `#1e282d` | `30, 40, 45` | Radial glow, centred at the top of the hero |

```css
.nh-hero {
  background:
    radial-gradient(120% 80% at 50% 0%, #1e282d 0%, rgba(30, 40, 45, 0) 62%),
    linear-gradient(180deg, #171e22 0%, #131719 46%, #0e0f11 100%);
}
```

> The hero is the **only** section with a gradient. Every other section is flat `--nh-surface`.
> The radial glow blooms from behind the navbar notch, which is why the plate must stay darker.

### 2.3 Ink — the text ramp

| Token | Hex | RGB | Role |
| --- | --- | --- | --- |
| `--nh-ink` | `#f1f3f3` | `241, 243, 243` | Primary text — headlines, nav links, product names |
| `--nh-ink-soft` | `#d5d9da` | `213, 217, 218` | Secondary text — footer column links |
| `--nh-muted` | `#8f9598` | `143, 149, 152` | Body copy (`.nh-body`), eyebrows, prices, footer headings + bar |
| `--nh-muted-2` | `#6e7477` | `110, 116, 119` | Deepest muted step (reserved / lowest-priority meta) |

**Derived ink alphas used inline:**

| Value | Where |
| --- | --- |
| `rgba(241, 243, 243, 0.5)` | Hero spec labels (`.nh-hero__metaItem`) |
| `rgba(241, 243, 243, 0.68)` | Showcase card bottom labels (`--bl`, `--br`) |
| `rgba(241, 243, 243, 0.2)` | Footer wordmark **text-stroke** |
| `rgba(255, 255, 255, 0.86)` | Showcase card top labels (`--tl`, `--tr`) |
| `rgba(255, 255, 255, 0.75)` | Showcase card kicker |
| `rgba(255, 255, 255, 0.72)` | Pick-card meta (`01/Winter_2025`) |
| `rgba(255, 255, 255, 0.92)` | Pick card **B** title |
| `#ffffff` | Pick card **A** title, showcase card intro, video-card play glyph |
| `rgba(243, 244, 244, 0.45)` | Footer lead eyebrow — inline override in `site-footer.tsx` |
| `rgba(243, 244, 244, 0.75)` | Footer lead paragraph — inline override, `max-width: 34ch` |

### 2.4 Controls — inverted primary, glass secondary

| Token | Value | Role |
| --- | --- | --- |
| `--nh-solid-bg` | `#f2f4f4` | Primary pill / icon button background (near-white) |
| `--nh-solid-fg` | `#0d0e10` | Text on primary (near-black) |
| `--nh-solid-bg-hover` | `#ffffff` | Primary hover → pure white; also footer link hover |
| `--nh-ghost-bg` | `rgba(255, 255, 255, 0.08)` | Secondary "glass" pill |
| `--nh-ghost-bg-hover` | `rgba(255, 255, 255, 0.15)` | Secondary hover |
| `--nh-hairline` | `rgba(255, 255, 255, 0.13)` | **Every** 1px edge on the page |
| `--nh-nav-edge` | `rgba(255, 255, 255, 0.055)` | The navbar plate's curve stroke only — half the normal hairline |

> The two CTA weights are deliberately different *materials*, not two shades of white-on-dark:
> primary **inverts** to a light pill, secondary becomes **glass**. That's what keeps them
> distinguishable on a dark page.

### 2.5 Frosted panels & chips

| Token | Value | Role |
| --- | --- | --- |
| `--nh-panel` | `rgba(15, 17, 19, 0.76)` | Product card bottom panel — `backdrop-filter: blur(14px)` |
| `--nh-chip-bg` | `rgba(22, 25, 27, 0.72)` | Tag pill + heart button — `backdrop-filter: blur(8px)` |
| `--nh-chip-fg` | `#eef0f0` | Text/icon inside chips |

### 2.6 Oversized "ghost" display type

| Token | Value | Role |
| --- | --- | --- |
| `--nh-ghost` | `#1e2226` | The giant word **on the page** — one step *lighter* than the surface |
| `--nh-ghost-over` | `rgba(255, 255, 255, 0.86)` | The same letters where they cross **a photograph** |

> The rule: the oversized type always sits a step *away* from the page — lighter on dark,
> darker on light. It must never equal the surface value.

### 2.7 One-off literals (not tokenised)

| Value | Where |
| --- | --- |
| `rgba(184, 205, 214, 0 → .1 → .045 → 0)` | Hero ray-fan gradient — steel-blue tinted, **not** white |
| `#1c1f21 → #26292b 34% → #33373a 68% → #3e4245 100%` | Showcase card plate (`.nh-card3d__plate`) — lifts gently instead of ending in a white slab |
| `rgba(6,7,8,.3) → rgba(6,7,8,.08) 34% → rgba(16,17,19,.74) 86% → #101113 100%` | Pick-card scrim, dissolving each card's foot into the page |
| `rgba(255, 255, 255, 0.09)` → hover `0.17` | Product card's circular `→` button |
| `rgba(38, 42, 45, 0.92)` | Heart button on product hover |

### 2.8 Copy-paste swatch list

```
SURFACES   #101113  #16181a  #0a0b0c  #1a1c1e  #0f1214  #151b1e
HERO       #171e22  #131719  #0e0f11  #1e282d
INK        #f1f3f3  #d5d9da  #8f9598  #6e7477
CONTROLS   #f2f4f4  #0d0e10  #ffffff
GHOST      #1e2226  rgba(255,255,255,.86)
CHIP       #eef0f0
PLATE      #1c1f21  #26292b  #33373a  #3e4245
RAY TINT   rgb(184,205,214)
ALPHAS     .055 · .08 · .09 · .13 · .15 · .17 · .2 · .5 · .68 · .72 · .75 · .76 · .86 · .92
```

**Contrast:** `--nh-ink` on `--nh-surface` ≈ 15.5:1. `--nh-muted` on `--nh-surface` ≈ 6.1:1.
`--nh-solid-fg` on `--nh-solid-bg` ≈ 17:1. All comfortably AA; the sub-50% alpha meta labels are
decorative spec text, not content.

---

## 3. TYPOGRAPHY

### 3.1 The family

**Archivo** (Google, variable) — loaded via `next/font` as `--font-archivo`, `display: swap`,
axes `wght 100–900` **and `wdth 62%–125%`**. The width axis is the point: the page uses
`font-stretch` as a design dimension, not just weight.

Fallback: `"Archivo Fallback"` → `local("Arial")` with metric overrides
(`ascent-override: 88.96%`, `descent-override: 21.28%`, `size-adjust: 98.70%`) so there is no
layout shift on swap.

### 3.2 The signature two-cut headline

Every headline on the page is **one sentence split across two cuts of the same family** —
a heavy condensed first half and a light extended second half.

```css
.nh-display {
  font-weight: 700;
  font-stretch: 100%;
  line-height: 0.96;
  letter-spacing: -0.035em;
  text-transform: uppercase;
}
.nh-display .nh-light {   /* the second half */
  font-weight: 300;
  font-stretch: 112%;
  letter-spacing: -0.015em;
}
```

Applied as: **GEAR UP EVERY SEASON / EVERY** `Workout!` · **TOP WORKOUT GEAR FOR** `Peak`
**PERFORMANCE!** · **FRESH FITS FOR** `your next` **WORKOUT!**

### 3.3 Utility type classes

| Class | Size | Line-height | Tracking | Weight | Colour |
| --- | --- | --- | --- | --- | --- |
| `.nh-eyebrow` | `11px` | `1` | `0.06em` | `400` | `--nh-muted`, uppercase |
| `.nh-body` | `14px` | `1.55` | `0` | `400` | `--nh-muted` |

### 3.4 Full type scale (as rendered)

| Element | Size | Weight | Stretch | LH | Tracking |
| --- | --- | --- | --- | --- | --- |
| `.nh-hero__title` | `clamp(2.1rem, 5.3vw, 5.25rem)` | 700/300 | 100/112% | `.96` | `-.035em` |
| `.nh-nav__logo` | `26px` | 400 | **108%** | `1` | `.01em` |
| `.nh-nav__link` | `12px` | 400 | — | — | `.04em` uc |
| `.nh-pill` | `12px` | 400 | — | — | `.045em` uc |
| `.nh-hero__metaItem` | `11.5px` | — | — | `1.35` | `.045em` uc |
| `.nh-editorial__ghost` | **`16.4vw`** | 300 | **118%** | `.8` | `.005em` uc |
| `.nh-picks__title` | `clamp(1.5rem, 3.25vw, 3.2rem)` | 700/300 | — | `.96` | `-.035em` |
| `.nh-pick__meta` | `12px` | — | — | `1.25` | `.03em` uc |
| `.nh-pick__title` | `clamp(1.4rem, 2.5vw, 2.4rem)` | **400** | — | `1.08` | `-.02em` uc |
| `.nh-showcase__marquee` | `clamp(4.5rem, 12.5vw, 12.5rem)` | 300 | **118%** | `.9` | `.005em` uc |
| `.nh-card3d__label` | `11.5px` | — | — | `1.35` | `.02em` uc, `max-width: 12ch` |
| `.nh-card3d__introTitle` | `clamp(1rem, 1.55vw, 1.5rem)` | 700/300 | — | `.96` | `-.035em` |
| `.nh-fits__title` | `clamp(1.7rem, 3.6vw, 3.4rem)` | 700/300 | — | `.96` | `-.035em`, centred |
| `.nh-product__name` | `13.5px` | — | — | `1.3` | `-.005em` |
| `.nh-product__price` | `12px` | — | — | `1.3` | — |
| `.nh-tag` | `11.5px` | — | — | — | `.01em` |
| `.nh-foot__col h4` | `11px` | 400 | — | — | `.08em` uc |
| `.nh-foot__col a` | `13.5px` | — | — | — | — |
| `.nh-foot__word` | `clamp(3.4rem, 15.5vw, 15rem)` | 300 | **118%** | `.82` | `.005em` uc |
| `.nh-foot__bar` | `11.5px` | — | — | — | `.04em` uc |

**Pattern:** the three oversized "ghost" types (editorial word, showcase marquee, footer wordmark)
share exactly one recipe — `font-weight: 300`, `font-stretch: 118%`, `letter-spacing: 0.005em`,
uppercase, sub-1 line-height. That extended-light cut *is* the page's brand voice.

---

## 4. SHAPE, SPACE & MOTION TOKENS

### 4.1 Radii

| Token | Value | Applied to |
| --- | --- | --- |
| `--nh-radius-card` | `14px` | Editorial frames `a`/`c`, product tiles |
| `--nh-radius-lg` | `22px` | Editorial frame `b`, pick cards, showcase cards |
| `--nh-radius-xl` | `28px` | Reserved |
| — | `999px` | All pills, icon buttons, tags, heart, `→`, avatars, dots |
| — | `12px` | Video card |
| — | `11px` | Product bottom panel |

### 4.2 Spacing

| Token / value | Meaning |
| --- | --- |
| `--nh-gutter: clamp(1rem, 3.2vw, 3.25rem)` | The single horizontal rhythm — nav, wrap, hero copy, hero asides |
| `.nh-wrap` | `max-width: 1560px; margin: 0 auto; padding: 0 var(--nh-gutter)` |
| `.nh-section` | `padding: clamp(4rem, 9vw, 9.5rem) 0` |
| Navbar height | `92px` (→ `74px` ≤860px) |
| Hero height | `100svh` — pinned to exactly one viewport, never taller |
| Showcase height | `500svh` (`COUNT × 100svh`, COUNT = 5 slides) |

### 4.3 Easing & duration

| Token | Value | Use |
| --- | --- | --- |
| `--nh-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | **The house curve** (`EASE_OUT` in JS too) — ease-out-quint feel. All reveals, image scales, underlines |
| `--nh-ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | Colour/background transitions only |

Durations in use: `0.3s` (heart bg, footer link) · `0.35s` (pill bg/colour/transform) ·
`0.4s` (`→` transform) · `0.45s` (nav underline) · `0.9s` (video-card zoom) ·
`1.1s` (pick zoom) · `1.15s` (product zoom, ghost word reveal).

---

## 5. COMPONENT LIBRARY

### 5.1 Navbar — `.nh-nav`

The signature element: a **notched SVG plate**, not a rectangle. Full-width wings drop to `y=62`,
a raised centre tab lifts to `y=26`, joined by curved shoulders — the logo sits in the raised tab.

```
viewBox="0 0 1600 92"  preserveAspectRatio="none"
d="M0 0 H1600 V62 H1100 C1040 62 1040 26 980 26 H620 C560 26 560 62 500 62 H0 Z"
```

- `.nh-nav__plateFill` → `fill: var(--nh-nav-plate)` `#0f1214`
- `.nh-nav__plateEdge` → `stroke: var(--nh-nav-edge)` `rgba(255,255,255,.055)`, `stroke-width: 1`,
  **`vector-effect: non-scaling-stroke`** (required — `preserveAspectRatio="none"` stretches the
  viewBox unevenly and would otherwise thin the horizontals to nothing)
- `.nh-nav__inner` — `grid-template-columns: 1fr auto 1fr`, `align-items: start`, height 100%
- The header is **`position: relative`, not sticky** — it scrolls away with the hero by design
- It is a `motion.header`: drops in from `y: -26, opacity: 0` over `0.8s` at `delay: 0.1` *(opt-in, §6.2)*
- Links: `SHOP · MEN · WOMEN · TRENDING` | `ICED_OUT` | `SEASONAL · ACCESSORIES` + actions
- **Hover:** a 1px `currentColor` underline wipes in — `scaleX(0) → 1`, `transform-origin`
  flips `right → left`, `0.45s var(--nh-ease)`

### 5.2 Buttons — `.nh-pill`, `.nh-icon-btn`

```css
.nh-pill { height: 38px; padding: 0 20px; border-radius: 999px;
           font-size: 12px; letter-spacing: .045em; text-transform: uppercase; }

.nh-pill--dark  { background: #f2f4f4; color: #0d0e10; }
.nh-pill--dark:hover  { background: #fff; transform: translateY(-1px); }

.nh-pill--light { background: rgba(255,255,255,.08); color: #f1f3f3;
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.13); }
.nh-pill--light:hover { background: rgba(255,255,255,.15); transform: translateY(-1px); }

.nh-icon-btn { width: 38px; height: 38px; border-radius: 999px;
               background: #f2f4f4; color: #0d0e10; }
```

> **Hairline rule (page-wide):** edges are drawn as `box-shadow: inset 0 0 0 1px` — **never**
> `border`. A border would eat a pixel of every control's content box and shift the layout.

### 5.3 Hero — `.nh-hero`

| Part | Detail |
| --- | --- |
| `.nh-hero` | `height: 100svh`, `margin-top: -92px; padding-top: 92px` (the nav overlays it), `overflow-x: clip; overflow-y: visible`, `z-index: 2` |
| `.nh-hero__rays` | **16** hairlines fanned from `50%/56%`, each `width: 50%; height: 1px`, `transform-origin: 0 50%`, rotated in ±pairs (`-64°/244°`, `-48°/228°`, …). Gradient `rgba(184,205,214,·)` `0 → .1 @32% → .045 @70% → 0`. Both ends land on zero so the convergence point never builds a bright knot. Clipped by `.nh-hero__rayClip` |
| `.nh-hero__copy` | Centred, `z-index: 20`, tucked under the nav |
| `.nh-hero__stage` | `flex: 1`, `min-height: min(300px, 32svh)` — takes the *leftover* height so the subject scales to the room available |
| `.nh-hero__modelWrap` | `width: clamp(230px, 25vw, 400px)`, `aspect-ratio: 719 / 1267`, `top: clamp(-9rem, -12vh, -4.5rem)`, `z-index: 12`. The image is a background-removed PNG (`/images/hero-model.png`) so the rays genuinely pass *behind* the subject; it hangs past the hero's bottom edge on purpose |
| `.nh-hero__meta` | 4 corner spec labels (`01 / Drop_2025`, `Shocks:Shoe`) in `rgba(241,243,243,.5)`, each with a 5px `currentColor` dot |
| `.nh-hero__aside--left` | 3 stacked 44px avatars (`-13px` overlap, `box-shadow: 0 0 0 2px #151b1e`) + a `.nh-body` line with `text-indent: 5.5em` so it wraps around the avatar cluster |
| `.nh-hero__aside--right` | `.nh-videocard` — `aspect-ratio: 16/11`, `radius: 12px`, well `#0a0b0c`, image at `opacity: .62; filter: grayscale(1) contrast(1.05)`, white play glyph; hover `scale(1.06)` over `0.9s` |

Both asides are anchored to **the fold**, not the section: `bottom: calc(100% - 100svh + clamp(2rem, 8vw, 6.5rem))`.

### 5.4 Blinds reveal — `.nh-blinds` *(shared primitive)*

The page's signature image-in animation. Every photograph enters through it.

```css
.nh-blinds { position: relative; width: 100%; height: 100%; overflow: hidden; }
.nh-blinds__strip { position: absolute; inset: 0; will-change: clip-path, transform; }
.nh-blinds img { width: 100%; height: 100%; object-fit: cover; }
```

Every slice is a **full-size copy** of the image; the band *and* the wipe are both carried by a
single `clip-path` (e.g. `inset(0% 100% 93.75% 0)` + `translateX(-34px)`), so neighbouring slices
can never round apart into a seam. Slice counts observed: **16** (hero) · **9 / 13 / 9** (editorial
frames a / b / c).

### 5.5 Editorial — `section#workout` `.nh-editorial`

An absolutely-positioned composition on a fixed `800 / 480` stage (`min-height: 420px`) — measured
off the reference frame rather than nudged with margins.

| Frame | left | top | width | height | radius |
| --- | --- | --- | --- | --- | --- |
| `__a` | `6.25%` | `17.7%` | `14.4%` | `35.4%` | `14px` |
| `__b` | `36.25%` | `17.3%` | `26.9%` | `62.5%` | `22px` |
| `__c` | `75.6%` | `43.7%` | `14.6%` | `36%` | `14px` |
| `__note--tr` | `74.4%` | `16%` | `17%` | — | — |
| `__note--bl` | `6.25%` | `77.7%` | `16%` | — | — |

The word **WORKOUT** is rendered at `16.4vw` in `--nh-ghost` `#1e2226` behind everything — then
re-rendered **once per frame**, clipped to that frame, in `--nh-ghost-over` `rgba(255,255,255,.86)`.
Each `.nh-editorial__ghostClip` rebuilds the section box in inverse (`.nh-editorial__b` →
`left: -134.76%; top: -27.68%; width: 371.75%; height: 160%`) so the bright letters land pixel-exact
on top of the dark ones. **Keep clip geometry in step with frame geometry.**

### 5.6 Top picks — `section#picks`

- `.nh-picks__head` — `grid-template-columns: 1fr minmax(0, 260px)` (eyebrow + title | body copy)
- `.nh-picks__grid` — 2 columns, gap `clamp(1rem, 1.6vw, 1.5rem)`
- `.nh-pick` — `aspect-ratio: 1 / 1.02`, radius `22px`, `isolation: isolate`
- `.nh-pick::after` — the scrim that dissolves each card's foot into the page:
  `linear-gradient(180deg, rgba(6,7,8,.3) 0%, rgba(6,7,8,.08) 34%, rgba(16,17,19,.74) 86%, var(--nh-surface) 100%)`
- Meta top-right (`01/Winter_2025`, `02/Summer_2025`) · title top-left, `max-width: 9ch`
- `.nh-pick--b` flips the title to `bottom: clamp(3.5rem, 9vw, 7rem)` at `rgba(255,255,255,.92)`
- Hover: `img { transform: scale(1.045) }` over `1.1s var(--nh-ease)`

### 5.7 Pinned showcase — `section#showcase` `.nh-card3d`

`height: 500svh` with a `position: sticky; top: 0; height: 100svh` viewport inside. Scroll drives
both a 5-card swap and two counter-running marquee bands.

| Layer | z | Detail |
| --- | --- | --- |
| `.nh-showcase__marquee--top` | 1 | `top: 21%`, `x: 4% → -44%` |
| `.nh-showcase__marquee--bottom` | 1 | `bottom: 17%`, `x: -44% → 4%` |
| `.nh-showcase__stack` | 5 | `width: clamp(240px, 26vw, 400px)`, `aspect-ratio: 3 / 4.02` |

Both bands read `FRESH FITS FOR YOUR NEXT WORKOUT ×4` in `--nh-ghost` — they run on the section
background only, so the type passes **behind** the opaque card, never over it.

**Card anatomy (`.nh-card3d`)** — 5 stacked absolutely at `inset: 0`:

```
z=1   .nh-card3d__plate  linear-gradient(180deg, #1c1f21 0%, #26292b 34%, #33373a 68%, #3e4245 100%)
z=20  .nh-card3d__shot   masked photograph
z=30  .nh-card3d__intro  (first card only) kicker "LEVEL UP" + "LEVEL UP WITH THE LATEST IN workout wear"
z=30  .nh-card3d__label  ×4 corners
```

The shot is masked down to a central column with **two intersected masks** — a vertical band that
leaves the plate exposed at head and foot, plus a soft-sided radial column so it reads as a subject
rather than a pasted rectangle:

```css
mask-image:
  linear-gradient(180deg, rgba(0,0,0,0) 4%, #000 21%, #000 76%, rgba(0,0,0,0) 95%),
  radial-gradient(64% 100% at 50% 50%, #000 52%, rgba(0,0,0,0) 100%);
mask-composite: intersect;                     /* -webkit-mask-composite: source-in */
object-position: 50% 35%;
```

Labels: `--tl` / `--tr` at `top: 22%`, `rgba(255,255,255,.86)`; `--bl` / `--br` at `bottom: 12%`,
`rgba(241,243,243,.68)` — copy runs `LINER SHORT & INNER THERMAL` / `12/08/2024 DELIVERY` /
`FALL / WINTER 2024` / `SHOCKS:SHOE` across the five slides.

### 5.8 Product grid — `section#fits`

- `.nh-fits__head` — `grid-template-columns: 1fr auto 1fr` (eyebrow | centred title | eyebrow)
- `.nh-fits__grid` — **4 columns**, gap `clamp(0.75rem, 1.3vw, 1.25rem)`, 8 tiles
- `.nh-product` — `aspect-ratio: 1 / 1.45`, radius `14px`, `isolation: isolate`

**Chips** (`top: 10px; right: 10px`) — `.nh-tag` `height: 26px; padding: 0 13px` and `.nh-heart`
`26×26`, both `background: rgba(22,25,27,.72)`, `backdrop-filter: blur(8px)`,
`box-shadow: inset 0 0 0 1px rgba(255,255,255,.13)`.

**Panel** (`left/right/bottom: 8px`, `radius: 11px`, `padding: 10px 10px 10px 14px`) —
`background: rgba(15,17,19,.76)`, `backdrop-filter: blur(14px)`, same inset hairline. Holds
name `13.5px` `--nh-ink` + price `12px` `--nh-muted` + a 28px `→` circle at `rgba(255,255,255,.09)`.

**Hover:** image `scale(1.055)` @ `1.15s` · heart → `rgba(38,42,45,.92)` · `→` circle →
`rgba(255,255,255,.17)` + `translateX(2px)`.

**Foot:** a centred `.nh-pill--dark` at `height: 40px; padding-right: 6px` with an inverted
28px circle inside (`background: var(--nh-solid-fg); color: var(--nh-solid-bg)`).

### 5.9 Footer — `.nh-foot`

```css
.nh-foot {
  background: var(--nh-surface-3);           /* #0a0b0c */
  border-top: 1px solid var(--nh-hairline);  /* the page is dark, so it can't rely on tone alone */
  padding: clamp(3.5rem, 7vw, 6.5rem) 0 clamp(1.5rem, 3vw, 2.5rem);
}
```

- `.nh-foot__top` — flex, `justify-content: space-between`, `align-items: flex-end`
- 3 columns: **Shop** / **Support** / **Studio** — `h4` at `11px`/`.08em`/`--nh-muted`,
  links at `13.5px`/`--nh-ink-soft`, hover → `#ffffff`
- `.nh-foot__word` — the wordmark **ICED_OUT** as pure outline:
  `color: transparent; -webkit-text-stroke: 1px rgba(241,243,243,.2)` at `clamp(3.4rem, 15.5vw, 15rem)`
- `.nh-foot__bar` — hairline rule above, `11.5px`/`.04em`/uppercase/`--nh-muted`:
  `© 2026 Iced_out` · `Every season · every workout`

---

## 6. MOTION SYSTEM  *(opt-in — see the banner at the top)*

Library: **Motion / Framer Motion** (`motion/react`). Every single transition on the page uses one
curve. There are no springs anywhere; nothing is time-looped; every non-load animation is either
`whileInView` (fires once) or scroll-linked via `useScroll` + `useTransform`.

```ts
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;   // === --nh-ease, an out-quint feel
```

### 6.1 The three primitives

Everything on the page is built from exactly three motion components plus raw `motion.*` elements.

#### `Reveal` — the house entrance

```ts
Reveal({ children, delay = 0, y = 26, className, once = true, amount = 0.35 })
```

| | |
| --- | --- |
| initial | `{ opacity: 0, y }` — default `y: 26` |
| whileInView | `{ opacity: 1, y: 0 }` |
| viewport | `{ once: true, amount: 0.35 }` |
| transition | `{ duration: 0.72, delay, ease: EASE_OUT }` |

Used for: eyebrows, body copy, editorial notes, pick cards (`y: 40`), the fits foot pill,
footer blocks and footer columns.

#### `SplitHeading` — the character-split headline

```ts
SplitHeading({ segments, className, as = "h2", delay = 0, stagger = 0.022, once = true })
```

Splits each segment into **per-character** `inline-block whitespace-pre` spans (a literal `\n`
in a segment emits a `<br>` instead). Segments carrying `light: true` get `.nh-light` — that is
how the two-cut headline (§3.2) is expressed.

| | |
| --- | --- |
| trigger | `useInView(ref, { once: true, amount: 0.4 })` |
| parent transition | `{ delayChildren: delay, staggerChildren: 0.022 }` |
| char `hidden` | `{ opacity: 0, y: "0.42em", filter: "blur(5px)" }` |
| char `show` | `{ opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: 0.62, ease: EASE_OUT } }` |
| a11y | `aria-label` on the parent = the joined text; every span is `aria-hidden` |

> `y` is in **em**, not px — the rise scales with the type size, so a `10rem` hero headline and a
> `1.5rem` card title read as the same gesture.

#### `BlindsImage` — the signature move

```ts
BlindsImage({ src, alt, slices = 14, className, imgClassName,
              priority = false, delay = 0, once = true, direction = "center" })
```

The image assembles itself out of horizontal bands instead of fading. Each slice is a
**full-size copy** of the image, and both the band and the wipe live in a **single `inset()`** —
sharing one box means adjacent bands resolve to exactly the same edge. Stacking cropped boxes
instead leaves hairline seams wherever the percentages round apart.

```ts
const top    = (i / slices) * 100;
const bottom = 100 - ((i + 1) / slices) * 100;
const shut   = `inset(${top}% 100% ${bottom}% 0)`;   // closed  — clipped to zero width
const open   = `inset(${top}% 0%   ${bottom}% 0)`;   // open    — full width
const offset = i % 2 === 0 ? -34 : 34;               // alternating side-slip, in px
```

| | |
| --- | --- |
| trigger | `useInView(ref, { once: true, amount: 0.2 })` |
| initial | `{ clipPath: shut, x: offset }` |
| animate | `{ clipPath: open, x: 0 }` |
| transition | `{ duration: 0.78, delay: delay + order(i) * 0.055, ease: EASE_OUT }` |
| `will-change` | `clip-path, transform` (set in CSS on `.nh-blinds__strip`) |

**`order(i)` — the three stagger directions:**

```ts
direction === "down"   →  i                              // top band first
direction === "up"     →  slices - 1 - i                 // bottom band first
direction === "center" →  Math.abs(i - (slices - 1) / 2) // middle band outwards  (default)
```

Only the **first** slice carries the real `alt`; the other copies get `alt=""` so screen readers
hear the image once. `priority` maps to `loading="eager"`, everything else is `lazy`.

### 6.2 Hero load choreography — exact

The order is the whole point: the subject arrives **alone and oversized**, holds, drops into place,
and only then does the rest of the furniture appear.

```ts
const T = {
  blinds:    0.05,   settle:  1.0,   settleDur: 0.5,
  review:    1.5,    film:    1.6,   cta:       1.68,
  headline:  1.78,   meta:    2.05,
};
```

| t (s) | Element | initial → animate | duration | ease |
| --- | --- | --- | --- | --- |
| `0.10` | `.nh-nav` (`motion.header`) | `{y: -26, opacity: 0}` → `{y: 0, opacity: 1}` | `0.8` | EASE_OUT |
| `0.05` | Hero `BlindsImage` | `slices: 16`, `direction: "center"`, `priority` | `0.78`/slice | EASE_OUT |
| `1.00` | `.nh-hero__model` | `{scale: 1.24, y: "-7%"}` → `{scale: 1, y: "0%"}` | `0.5` | EASE_OUT |
| `1.00 + i·0.05` | `.nh-hero__ray` ×16 | `{opacity: 0, scaleX: 0.2}` → `{opacity: 1, scaleX: 1}` | `1.4` | EASE_OUT |
| `1.50` | `.nh-hero__aside--left` | `{opacity: 0, y: 22}` → `{opacity: 1, y: 0}` | `0.7` | EASE_OUT |
| `1.50` | `.nh-hero__aside--right` | `{opacity: 0, y: 22}` → `{opacity: 1, y: 0}` | `0.75` | EASE_OUT |
| `1.68` | `.nh-hero__cta` | `{opacity: 0, y: 14}` → `{opacity: 1, y: 0}` | `0.6` | EASE_OUT |
| `1.78` | `.nh-hero__title` | `SplitHeading`, `stagger: 0.022` | `0.62`/char | EASE_OUT |
| `2.05 + i·0.09` | `.nh-hero__metaItem` ×4 | `{opacity: 0, y: 12}` → `{opacity: 1, y: 0}` | `0.7` | EASE_OUT |

**Ray geometry.** Eight base angles, each mirrored across the vertical to give 16:

```ts
const RAY_ANGLES = [-64, -48, -33, -19, 19, 33, 48, 64];
RAY_ANGLES.flatMap((angle, i) => [angle, 180 - angle].map(deg => /* ray at `${deg}deg` */))
// → -64/244, -48/228, -33/213, -19/199, 19/161, 33/147, 48/132, 64/116
// the stagger index `i` is the PAIR index (0–7), so both rays of a pair fire together
```

**Headline segments** (hero):

```ts
[ { text: "Gear up every season\n" },
  { text: "Every " },
  { text: "Workout!", light: true } ]
```

> **Note:** `T.film = 1.6` is declared but unused — the right aside actually fires at `T.review`
> (`1.5`) with a slightly longer `0.75s` duration. That longer duration is what reads as the lag,
> not a later start. Keep it if you're reproducing the page 1:1.

### 6.3 Scroll-linked transforms — complete

All driven by `useScroll({ target: ref, offset })` + `useTransform`. None of these are `whileInView`;
they are continuous and reversible.

| Section | `offset` | Output | Mapped from → to |
| --- | --- | --- | --- |
| Hero | `["start start", "end start"]` | `modelY` on `.nh-hero__modelParallax` | `[0,1] → [0, -70]` px |
| " | " | `copyY` on `.nh-hero__copy` | `[0,1] → [0, 120]` px |
| " | " | `fade` — copy, meta layer, **both** asides | `[0, 0.8] → [1, 0]` |
| Editorial | `["start end", "end start"]` | `ghostX` on every WORKOUT copy | `[0,1] → ["-6%", "6%"]` |
| " | " | `ghostY` on every WORKOUT copy | `[0,1] → [70, -70]` px |
| Showcase | `["start start", "end end"]` | `topX` marquee | `[0,1] → ["4%", "-44%"]` |
| " | " | `bottomX` marquee | `[0,1] → ["-44%", "4%"]` |
| " | " | per-slide `opacity` + `shotScale` | see §6.5 |

> **Two elements, two transforms.** The hero model's scroll parallax rides on
> `.nh-hero__modelParallax` while the load settle rides on `.nh-hero__model` — separate wrappers so
> the two transforms can never overwrite each other. Same reason the resting position lives on a
> third element, `.nh-hero__modelWrap`, in CSS only.

### 6.4 Section entrance specs

#### 02 · Editorial (`#workout`)

**The ghost word** — one shared `useInView(ref, { once: true, amount: 0.25 })` drives **every**
copy of the word. If each copy watched its own frame they would reveal at different moments and
drift out of register.

```ts
variants = {
  hidden: { opacity: 0, y: "34%",  scaleX: 1.08 },
  show:   { opacity: 1, y: "0%",   scaleX: 1,
            transition: { duration: 1.15, ease: EASE_OUT } },
}
```

**The three frames** — each blinds in with its own slice count, delay and direction:

| Frame | `src` | `slices` | `delay` | `direction` |
| --- | --- | --- | --- | --- |
| `__a` | still-life | `9` | `0.05` | `down` |
| `__b` | campaign | `13` | `0.12` | `center` |
| `__c` | drop | `9` | `0.2` | `up` |

**The notes** — `Reveal delay: 0.25` (top-right) and `Reveal delay: 0.32` (bottom-left).

#### 03 · Top picks (`#picks`)

**`PickTitle`** — a per-**word** ramp, and the effect the source leans on hardest here:

```ts
transition: { staggerChildren: 0.075 }
viewport:   { once: true, amount: 0.45 }
variants = {
  hidden: { opacity: 0.06, y: 12 },                                    // ← NOT 0
  show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
}
```

> `opacity: 0.06` is the trick. Words don't appear from nothing — they sit **ghosted** on the
> photograph and resolve. At `0.075s` apart the last line is still faint while the first is solid,
> and that lag *is* the effect. Setting it to `0` kills it.

Head: eyebrow `Reveal` (default) · title `SplitHeading` (default `delay: 0`) · body `Reveal delay: 0.15`.
Cards: `Reveal` with `delay: i * 0.12` and `y: 40` (a deeper rise than the `26` default).

#### 04 · Showcase (`#showcase`)

Stack container: `{opacity: 0, y: 44}` → `{opacity: 1, y: 0}`, `duration: 0.9`,
`viewport: { once: true, amount: 0.2 }`.
Marquee: `PHRASE = "Fresh fits for your next workout"` repeated **4×** per row, two rows
counter-running (§6.3).

#### 05 · Fits (`#fits`)

```ts
// ProductCard — the source washes the row in left-to-right, one card behind the next
initial:    { opacity: 0, y: 34, scale: 0.985 }
whileInView:{ opacity: 1, y: 0,  scale: 1 }
viewport:   { once: true, amount: 0.2 }
transition: { duration: 0.78, ease: EASE_OUT,
              delay: (index % 4) * 0.09 + Math.floor(index / 4) * 0.06 }
```

A **diagonal cascade**: column position dominates (`0.09` per column), row adds a smaller
`0.06` offset. On an 8-card 4-wide grid the delays run
`0, .09, .18, .27 / .06, .15, .24, .33`.

Head: eyebrow `Reveal` · title `SplitHeading` · right eyebrow `Reveal delay: 0.1` ·
foot pill `Reveal delay: 0.15`.

#### Footer

Lead block `Reveal` (default). Columns `Reveal` with `delay: 0.08 * i`.
The outline wordmark and the bottom bar are **static** — they never animate.

### 6.5 The pinned showcase crossfade — the maths

`COUNT = 5`, section `height: 500svh`, sticky viewport `100svh`. One scroll progress
(`0 → 1` across the whole section) drives all five slides.

```ts
const band    = 1 / COUNT;        // 0.2
const start   = index * band;
const end     = start + band;
const feather = band * 0.3;       // 0.06 — the crossfade width
```

| Slide | `inRange` keyframes | `opacity` | `shotScale` |
| --- | --- | --- | --- |
| **first** | `[0, end - f·0.35, end + f, 1]` | `[1, 1, 0, 0]` | `[1, 1, 0.96, 0.96]` |
| **middle** | `[0, start - f, start + f·0.35, end - f·0.35, end + f, 1]` | `[0, 0, 1, 1, 0, 0]` | `[1.09, 1.09, 1, 1, 0.96, 0.96]` |
| **last** | `[0, start - f, start + f·0.35, 1]` | `[0, 0, 1, 1]` | `[1.09, 1.09, 1, 1]` |

Each card fades **in** while its photo settles from `1.09 → 1`, then fades **out** while the photo
continues to `0.96`. Only `.nh-card3d__shot` scales — the plate and the labels stay put, so the
picture breathes inside a fixed card.

> **Critical — why every list spans `0 … 1`:** Motion hands scroll-linked transforms to the native
> scroll timeline. **Outside a declared range the animation simply stops applying**, and the element
> drifts back to its base value instead of holding the last keyframe. Every keyframe list therefore
> has to start at `0`, end at `1`, and ascend strictly. Spanning the full range is what keeps a
> slide hidden once it has passed. Trimming the leading `0` or trailing `1` makes passed slides
> reappear.

### 6.6 Interaction micro-motion (pure CSS, no JS)

| Target | Change | Duration | Ease |
| --- | --- | --- | --- |
| `.nh-nav__link::after` | `scaleX(0) → 1`, origin `right → left` | `0.45s` | `--nh-ease` |
| `.nh-pill--dark` | bg `#f2f4f4 → #fff`, `translateY(-1px)` | `0.35s` | soft / `--nh-ease` |
| `.nh-pill--light` | bg `.08 → .15` alpha, `translateY(-1px)` | `0.35s` | soft / `--nh-ease` |
| `.nh-icon-btn` | bg → `#fff`, `translateY(-1px)` | `0.35s` | soft / `--nh-ease` |
| `.nh-videocard img` | `scale(1.06)` | `0.9s` | `--nh-ease` |
| `.nh-pick img` | `scale(1.045)` | `1.1s` | `--nh-ease` |
| `.nh-product img` | `scale(1.055)` | `1.15s` | `--nh-ease` |
| `.nh-heart` | bg → `rgba(38,42,45,.92)` | `0.3s` | soft |
| `.nh-product__go` | bg `.09 → .17`, `translateX(2px)` | `0.3s` / `0.4s` | soft / `--nh-ease` |
| `.nh-foot__col a` | colour → `#ffffff` | `0.3s` | soft |

Note the split: **colour/background** transitions use `--nh-ease-soft`
`cubic-bezier(.4, 0, .2, 1)`; **transform** transitions use `--nh-ease`
`cubic-bezier(.22, 1, .36, 1)`. Never mix them on the same property.

### 6.7 Duration ladder

| Duration | Used by |
| --- | --- |
| `0.3s` | heart bg, `→` bg, footer link colour |
| `0.35s` | pill bg / colour / transform |
| `0.4s` | `→` translate |
| `0.45s` | nav underline wipe |
| `0.5s` | hero subject settle (`T.settleDur`) |
| `0.6s` | hero CTA |
| `0.62s` | **one character** of a split headline |
| `0.7s` | pick words, hero meta, hero left aside |
| `0.72s` | **`Reveal` — the house default** |
| `0.75s` | hero right aside |
| `0.78s` | **one blind slice**; product card |
| `0.8s` | navbar drop-in |
| `0.9s` | showcase stack; video-card zoom |
| `1.1s` | pick image zoom |
| `1.15s` | product image zoom; ghost-word reveal |
| `1.4s` | hero ray fan |

### 6.8 Stagger ladder

| Step | Used by |
| --- | --- |
| `0.022s` | characters in a split headline |
| `0.05s` | ray pairs (index 0–7) |
| `0.055s` | blind slices (× `order(i)`) |
| `0.06s` | product grid, per **row** |
| `0.075s` | words in a pick title |
| `0.08s` | footer columns |
| `0.09s` | hero meta labels; product grid per **column** |
| `0.12s` | pick cards |

### 6.9 Viewport-trigger ladder

| `amount` | Used by |
| --- | --- |
| `0.2` | `BlindsImage`, product cards, showcase stack |
| `0.25` | editorial ghost word |
| `0.35` | `Reveal` default |
| `0.4` | `SplitHeading` |
| `0.45` | pick titles |

**Every** in-view trigger on the page is `once: true`. Nothing re-animates on scroll-back.

### 6.10 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .nh-root *, .nh-root *::before, .nh-root *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

> **Gap worth knowing about:** this block neuters CSS `transition`s and `@keyframes` only. The
> Motion-driven work (hero load sequence, blind reveals, split headlines, scroll parallax, the
> pinned card stack) is applied as inline styles from JS and is **not** covered by it. If you are
> reproducing this motion somewhere that needs to honour the preference properly, gate it with
> Motion's `useReducedMotion()` and drop to a plain opacity fade — see §11.5.

---

## 7. RESPONSIVE

Three breakpoints, all `max-width`.

### `≤ 1100px`
- `.nh-picks__head` → single column
- `.nh-fits__grid` → **3 columns**

### `≤ 860px` (the big reflow)
- Navbar `92px → 74px`; `.nh-nav__links` **hidden**; logo padding `26px → 18px`; actions `52px`
- Hero offsets follow (`margin-top: -74px; padding-top: 74px`)
- `.nh-hero__aside` → `position: static`, full width, centred; **left** aside `order: 3`,
  **right** aside (video card) `display: none`
- `.nh-hero__meta` **hidden** — no room once the model fills the column
- Avatars centre; `text-indent` drops to `0`
- **Editorial abandons the measured composition** → `display: grid`, 2 columns, `gap: 1rem`.
  Frames become relative; `a`/`c` → `aspect-ratio: 3/4`; `b` → full-width `1/1` with `order: -1`;
  notes span `1 / -1`. Ghost word `16.4vw → 26vw`, wrap `top: 42%`
- `.nh-picks__grid` → 1 column · `.nh-fits__grid` → 2 columns · `.nh-fits__head` → 1 column,
  eyebrows hidden

### `≤ 520px`
- `.nh-fits__grid` → 1 column

---

## 8. ASSETS

| File | Used by |
| --- | --- |
| `/images/hero-model.png` | Hero subject — **background-removed PNG** (rays pass behind it) |
| `/images/avatar-1.jpg`, `-2`, `-3` | Hero social-proof cluster |
| `/images/drop-001-products.webp` | Editorial / grid |
| `/images/product-still-life-v2.webp` | Editorial / grid |
| `/images/campaign-after-hours-v2.webp` | Video card / showcase |
| `/images/iced-out-hero.webp` | Showcase slides |
| `/images/iced-out-og.jpg` | Showcase / OG |

---

## 9. IMPLEMENTATION RULES (the non-obvious ones)

These are load-bearing. Changing any of them visibly breaks the page.

1. **`overflow-x: clip`, never `hidden`** — on `.nh-root` and `.nh-hero`. `overflow-x: hidden` turns
   the element into a scroll container, which un-pins the showcase's sticky viewport and freezes
   every scroll-linked transform on the page. On `.nh-hero` it also lets `overflow-y: visible`
   stay legal (`hidden` + `visible` silently computes back to `auto` and adds a scrollbar).
2. **Hairlines are inset box-shadows, not borders** — a border eats a pixel of the content box and
   shifts the layout off the reference.
3. **Hero height is capped at `100svh`** and the stage's floor is measured in `svh`
   (`min(300px, 32svh)`), never in `vw`. A width-derived floor demands height a short window
   doesn't have and pushes the hero past the fold.
4. **`.nh-hero__model .nh-blinds img` is deliberately over-qualified** — the shared
   `.nh-blinds img` sets `object-fit: cover` for photographic panels and scores the same
   specificity. The extra class outscores it rather than relying on source order; without it the
   subject is cropped from the top and loses its head.
5. **Hero asides are anchored to the fold**, not the section:
   `bottom: calc(100% - 100svh + …)`. The hero is allowed to run taller than the viewport, so
   offsets measured off the section would drag the asides off-screen.
6. **The navbar plate must stay darker than `--nh-hero-top`.** At `#1a2125` it sat within a shade
   of the hero and the notched silhouette vanished.
7. **The ghost-clip percentages are the inverse of the frame geometry.** Edit one, edit both.
8. **Anything that fades out must fade into `--nh-surface`**, not white — otherwise every card
   ends in a bright halo.
9. **`vector-effect: non-scaling-stroke`** on the nav plate edge is mandatory under
   `preserveAspectRatio="none"`.

---

## 10. QUICK-START TOKEN BLOCK

Drop this on any container to inherit the page's look:

```css
.nh-root {
  /* surfaces */
  --nh-surface: #101113;  --nh-surface-2: #16181a;  --nh-surface-3: #0a0b0c;
  --nh-card-bg: #1a1c1e;  --nh-nav-plate: #0f1214;  --nh-ring: #151b1e;
  --nh-nav-edge: rgba(255,255,255,.055);

  /* hero */
  --nh-hero-top: #171e22; --nh-hero-mid: #131719;
  --nh-hero-bot: #0e0f11; --nh-hero-glow: #1e282d;

  /* ink */
  --nh-ink: #f1f3f3; --nh-ink-soft: #d5d9da; --nh-muted: #8f9598; --nh-muted-2: #6e7477;

  /* controls */
  --nh-solid-bg: #f2f4f4; --nh-solid-fg: #0d0e10; --nh-solid-bg-hover: #ffffff;
  --nh-ghost-bg: rgba(255,255,255,.08); --nh-ghost-bg-hover: rgba(255,255,255,.15);
  --nh-hairline: rgba(255,255,255,.13);

  /* panels + chips */
  --nh-panel: rgba(15,17,19,.76); --nh-chip-bg: rgba(22,25,27,.72); --nh-chip-fg: #eef0f0;

  /* oversized display type */
  --nh-ghost: #1e2226; --nh-ghost-over: rgba(255,255,255,.86);

  /* shape */
  --nh-radius-card: 14px; --nh-radius-lg: 22px; --nh-radius-xl: 28px;

  /* motion */
  --nh-ease: cubic-bezier(.22, 1, .36, 1);
  --nh-ease-soft: cubic-bezier(.4, 0, .2, 1);

  /* rhythm */
  --nh-gutter: clamp(1rem, 3.2vw, 3.25rem);
}
```

---

## 11. ANIMATION RECIPE LIBRARY  *(apply only on request)*

> Nothing in this section should be added to a page unless the user has explicitly asked for the
> `/new-home` animations. It exists so that when they do, the result is exact rather than
> approximated.

Dependency: `motion` (`import { motion, useScroll, useTransform, useInView } from "motion/react"`).

### 11.1 The three primitives — complete source

```tsx
"use client";
import { motion, useInView, type Variants } from "motion/react";
import { useRef } from "react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* ---------- Reveal: the house entrance ---------- */
export function Reveal({
  children, delay = 0, y = 26, className, once = true, amount = 0.35,
}: {
  children: React.ReactNode; delay?: number; y?: number;
  className?: string; once?: boolean; amount?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.72, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- SplitHeading: per-character blur-rise ---------- */
const charVariants: Variants = {
  hidden: { opacity: 0, y: "0.42em", filter: "blur(5px)" },
  show: {
    opacity: 1, y: "0em", filter: "blur(0px)",
    transition: { duration: 0.62, ease: EASE_OUT },
  },
};

type Segment = { text: string; light?: boolean };

export function SplitHeading({
  segments, className, as: Tag = "h2", delay = 0, stagger = 0.022, once = true,
}: {
  segments: Segment[]; className?: string;
  as?: "h1" | "h2" | "h3" | "p"; delay?: number; stagger?: number; once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.4 });
  const MotionTag = motion[Tag];
  let index = -1;

  return (
    <div ref={ref}>
      <MotionTag
        className={cn("nh-display", className)}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        transition={{ delayChildren: delay, staggerChildren: stagger }}
        aria-label={segments.map((s) => s.text).join("")}
      >
        {segments.map((segment, sIdx) => (
          <span
            key={`${segment.text}-${sIdx}`}
            aria-hidden
            className={segment.light ? "nh-light" : undefined}
          >
            {Array.from(segment.text).map((char) => {
              index += 1;
              if (char === "\n") return <br key={`br-${index}`} />;
              return (
                <motion.span
                  key={`${char}-${index}`}
                  className="inline-block whitespace-pre"
                  variants={charVariants}
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        ))}
      </MotionTag>
    </div>
  );
}

/* ---------- BlindsImage: the signature reveal ---------- */
export function BlindsImage({
  src, alt, slices = 14, className, imgClassName,
  priority = false, delay = 0, once = true, direction = "center",
}: {
  src: string; alt: string; slices?: number;
  className?: string; imgClassName?: string; priority?: boolean;
  delay?: number; once?: boolean; direction?: "up" | "down" | "center";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.2 });

  const order = (i: number) => {
    if (direction === "down") return i;
    if (direction === "up") return slices - 1 - i;
    return Math.abs(i - (slices - 1) / 2);   // centre-out
  };

  return (
    <div className={cn("nh-blinds", className)} ref={ref}>
      {Array.from({ length: slices }).map((_, i) => {
        // Band AND wipe share one inset() — adjacent bands then resolve to the
        // exact same edge. Stacking cropped boxes leaves hairline seams.
        const top = (i / slices) * 100;
        const bottom = 100 - ((i + 1) / slices) * 100;
        const shut = `inset(${top}% 100% ${bottom}% 0)`;
        const open = `inset(${top}% 0% ${bottom}% 0)`;
        const offset = i % 2 === 0 ? -34 : 34;

        return (
          <motion.div
            key={i}
            className="nh-blinds__strip"
            initial={{ clipPath: shut, x: offset }}
            animate={inView ? { clipPath: open, x: 0 } : { clipPath: shut, x: offset }}
            transition={{ duration: 0.78, delay: delay + order(i) * 0.055, ease: EASE_OUT }}
          >
            <img
              src={src}
              alt={i === 0 ? alt : ""}
              className={imgClassName}
              decoding="async"
              loading={priority ? "eager" : "lazy"}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
```

Required CSS for `BlindsImage`:

```css
.nh-blinds        { position: relative; width: 100%; height: 100%; overflow: hidden; }
.nh-blinds__strip { position: absolute; inset: 0; will-change: clip-path, transform; }
.nh-blinds img    { display: block; width: 100%; height: 100%; object-fit: cover; }
```

### 11.2 Hero load sequence

```tsx
const T = { blinds: 0.05, settle: 1.0, settleDur: 0.5,
            review: 1.5, film: 1.6, cta: 1.68, headline: 1.78, meta: 2.05 };

const RAY_ANGLES = [-64, -48, -33, -19, 19, 33, 48, 64];

const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
const modelY = useTransform(scrollYProgress, [0, 1],   [0, -70]);
const copyY  = useTransform(scrollYProgress, [0, 1],   [0, 120]);
const fade   = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

/* rays — 8 pairs, mirrored across the vertical */
{RAY_ANGLES.flatMap((angle, i) =>
  [angle, 180 - angle].map((deg) => (
    <motion.div key={deg} className="nh-hero__ray" style={{ rotate: `${deg}deg` }}
      initial={{ opacity: 0, scaleX: 0.2 }} animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 1.4, delay: T.settle + i * 0.05, ease: EASE_OUT }} />
  )))}

/* copy — scroll parallax + fade */
<motion.div className="nh-hero__copy" style={{ y: copyY, opacity: fade }}>
  <SplitHeading as="h1" className="nh-hero__title" delay={T.headline} stagger={0.022}
    segments={[{ text: "Gear up every season\n" },
               { text: "Every " },
               { text: "Workout!", light: true }]} />
  <motion.div className="nh-hero__cta"
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: T.cta, ease: EASE_OUT }}>…</motion.div>
</motion.div>

/* subject — parallax and settle on SEPARATE elements so they never overwrite */
<div className="nh-hero__modelWrap">                    {/* resting position, CSS only */}
  <motion.div className="nh-hero__modelParallax" style={{ y: modelY }}>
    <motion.div className="nh-hero__model"
      initial={{ scale: 1.24, y: "-7%" }} animate={{ scale: 1, y: "0%" }}
      transition={{ duration: T.settleDur, delay: T.settle, ease: EASE_OUT }}>
      <BlindsImage src={HERO_MODEL} alt="…" slices={16}
                   direction="center" delay={T.blinds} priority className="h-full" />
    </motion.div>
  </motion.div>
</div>
```

### 11.3 Ghost word + editorial frames

```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
const ghostX = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
const ghostY = useTransform(scrollYProgress, [0, 1], [70, -70]);
// ONE shared trigger for every copy — per-copy triggers drift out of register
const ghostInView = useInView(ref, { once: true, amount: 0.25 });

<motion.p
  className={`nh-editorial__ghost nh-editorial__ghost--${tone}`}
  initial="hidden"
  animate={inView ? "show" : "hidden"}
  variants={{
    hidden: { opacity: 0, y: "34%", scaleX: 1.08 },
    show:   { opacity: 1, y: "0%",  scaleX: 1,
              transition: { duration: 1.15, ease: EASE_OUT } },
  }}
>Workout</motion.p>

const FRAMES = [
  { key: "a", slices: 9,  delay: 0.05, direction: "down"   },
  { key: "b", slices: 13, delay: 0.12, direction: "center" },
  { key: "c", slices: 9,  delay: 0.2,  direction: "up"     },
];
```

### 11.4 Word-ramp title, product cascade, pinned stack

```tsx
/* --- pick title: words resolve OUT of a 6% ghost, not out of nothing --- */
<motion.h3 className="nh-pick__title"
  initial="hidden" whileInView="show"
  viewport={{ once: true, amount: 0.45 }}
  transition={{ staggerChildren: 0.075 }}>
  {text.split(" ").map((word, i) => (
    <motion.span key={i} className="inline-block" variants={{
      hidden: { opacity: 0.06, y: 12 },
      show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
    }}>{word}{i < words.length - 1 ? " " : ""}</motion.span>
  ))}
</motion.h3>

/* --- product grid: diagonal cascade across a 4-wide grid --- */
<MotionLink className="nh-product"
  initial={{ opacity: 0, y: 34, scale: 0.985 }}
  whileInView={{ opacity: 1, y: 0, scale: 1 }}
  viewport={{ once: true, amount: 0.2 }}
  transition={{ duration: 0.78, ease: EASE_OUT,
                delay: (index % 4) * 0.09 + Math.floor(index / 4) * 0.06 }} />

/* --- pinned showcase: section is COUNT*100svh, sticky child is 100svh --- */
const band = 1 / COUNT, start = index * band, end = start + band, f = band * 0.3;
const inRange = first ? [0, end - f * 0.35, end + f, 1]
              : last  ? [0, start - f, start + f * 0.35, 1]
              :         [0, start - f, start + f * 0.35, end - f * 0.35, end + f, 1];

const opacity   = useTransform(progress, inRange,
  first ? [1, 1, 0, 0] : last ? [0, 0, 1, 1] : [0, 0, 1, 1, 0, 0]);
const shotScale = useTransform(progress, inRange,
  first ? [1, 1, 0.96, 0.96] : last ? [1.09, 1.09, 1, 1]
        : [1.09, 1.09, 1, 1, 0.96, 0.96]);
// Lists MUST start at 0 and end at 1 — outside a declared range the transform
// stops applying and the element snaps back to base instead of holding.
```

### 11.5 Reduced-motion variant

If you need the motion to actually honour the OS preference (the CSS block in §6.10 does not
cover JS-driven transforms), gate at the source:

```tsx
import { useReducedMotion } from "motion/react";

const reduce = useReducedMotion();
// drop every rise/blur/scale to a plain fade, and skip scroll-linked transforms entirely
const initial   = reduce ? { opacity: 0 } : { opacity: 0, y: 26 };
const animate   = { opacity: 1, y: 0 };
const transition= reduce ? { duration: 0.2 } : { duration: 0.72, delay, ease: EASE_OUT };
// BlindsImage → render a single slice; SplitHeading → render the plain string
```

### 11.6 Porting checklist

When asked to apply this motion elsewhere:

1. Ship `EASE_OUT` and the three primitives together — they are the whole system.
2. Bring `.nh-blinds` / `.nh-blinds__strip` CSS with `BlindsImage`; it does not work without it.
3. Split-headline `y` must stay in **em**, never px, or it breaks across type sizes.
4. Ghost-style word reveals need **one shared trigger**, not one per copy.
5. Any scroll-linked keyframe list must span `0 → 1` inclusive and ascend strictly.
6. Keep parallax and entrance transforms on **separate wrapper elements**.
7. Keep the ease split: `--nh-ease-soft` for colour, `--nh-ease` for transform.
8. Every in-view trigger is `once: true` — nothing on this page replays.
9. If the container is a scroll container (`overflow-x: hidden`), sticky pinning and every
   scroll-linked transform inside it will freeze. Use `overflow-x: clip`.
