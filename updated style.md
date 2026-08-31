# N2B CRM — Frontend Style Guide (Updated)
# N2B CRM — Frontend Style Guide (Updated)

> **Scope:** everything under `node2begin-crm/src`. This is a *descriptive* audit of what the
> UI actually does today — every number in it was measured against source, and the dead-class
> claims were checked against the compiled CSS. Where the codebase contradicts itself, that is
> called out rather than smoothed over.
>
> **Audited:** 10 Aug 2026 · 326 `.tsx` + 78 `.ts` files · 63 route pages · 33 `ui/` primitives ·
> Tailwind 3.4.19 · Next 16.2.10 / React 19
>
> **Supersedes:** [STYLE.md](STYLE.md) (audited 1 Aug 2026). Keep that file for history; treat
> this one as current. §0 is the delta.
>
> ⚠ **Build-artifact caveat:** `out/_next/static/chunks/*.css` was built **29 Jul 2026**, before
> [tailwind.config.ts](tailwind.config.ts) (1 Aug) and the chrome tokens. Class-liveness checks
> below are marked **[verified-in-CSS]** only where the class predates that build. Newer ones are
> marked **[config-declared]** — valid in config, not yet present in a shipped bundle.

---

## 0. What changed since the 1 Aug audit

The app shell was rebuilt. This is not a repaint — it changes the geometry every page sits in.

| # | Change | Where |
|---|---|---|
| 1 | **Canvas is now hueless.** `--background: #f8fafc` → **`#f4f4f5`**. The old slate-50 carried a cool cast that read *lilac* next to white cards. | [globals.css:11](src/app/globals.css#L11) |
| 2 | **New chrome token family** `--n2b-chrome` / `-hover` / `-active` — white carrying ~4% indigo-600. The **only** tinted surfaces in the shell. | [globals.css:21-23](src/app/globals.css#L21-L23) |
| 3 | **Sidebar is a floating rounded card**, not a flush rail: `rounded-[26px]`, inset 18px on all sides, **68px ⇄ 272px** (was 64 ⇄ 240), pinnable, monochrome (no indigo accent). | [Sidebar.tsx](src/components/layout/Sidebar.tsx) |
| 4 | **Header is a floating rounded bar** — `h-[54px] rounded-[20px] max-w-[1760px]`, same surface + shadow as the rail. Was `h-16 border-b bg-white`. | [AppHeader.tsx](src/components/layout/AppHeader.tsx) |
| 5 | **The shell margin is a CSS variable.** `--n2b-sb` (86px collapsed / 290px pinned) replaces the hard-coded `ml-16`. Hover-expand *overlays* and never reflows the page. | [AuthWrapper.tsx:376](src/components/layout/AuthWrapper.tsx#L376) |
| 6 | **URL-derived breadcrumb** replaces the page title in the bar. Never shows a record id. | [AppHeader.tsx:162-238](src/components/layout/AppHeader.tsx#L162-L238) |
| 7 | **`/dashboard` runs its own frosted-glass surface system** (`DASH_*`), separate from `PageHero`/`SpotlightStatCard`. New rule: *colour lands on the glyph, never the chip.* | [SpotlightCard.tsx](src/app/dashboard/SpotlightCard.tsx) |
| 8 | **One canonical two-layer chrome shadow** now unifies rail + bar + glass cards + hero. | §7 |
| 9 | **The legacy HR design system in `globals.css` is now ~85% dead code**, and `app/hr/_components.tsx` has **zero importers**. Newly quantified. | §16 |
| 10 | 4 new keyframe pairs (`backdrop`/`panel`/`row` in/out) landed in the Tailwind config on 1 Aug. | [tailwind.config.ts:46-89](tailwind.config.ts#L46-L89) |

**New defect introduced by (1):** ~91 `bg-slate-50/{70,80,85,90,95}` scrims and 10
`min-h-screen bg-slate-50` wrappers still assume the canvas is `#f8fafc`. They now paint a
*cooler* translucent film over a hueless `#f4f4f5` canvas. Most visible on the sticky
`/projects/detail` tab rail (`bg-slate-50/85`). See §17.1.

---

## 1. Stack & where style lives

| Layer | Choice | File |
|---|---|---|
| Framework | Next.js **16.2.10** (App Router, `output: 'export'` — **static CSR**) | [next.config.mjs](next.config.mjs) |
| React | 19 | — |
| CSS engine | **Tailwind CSS 3.4.19**, `plugins: []` | [tailwind.config.ts](tailwind.config.ts) |
| Design tokens | CSS custom properties on `:root` | [globals.css](src/app/globals.css) |
| Headless primitives | **`@base-ui/react` ^1.6** (primary) + `radix-ui` ^1.5 (Avatar, Popover, DropdownMenu) | [components/ui/](src/components/ui/) |
| Variants | `class-variance-authority` + `tailwind-merge` via `cn()` | [lib/utils.ts](src/lib/utils.ts) |
| Icons | `lucide-react` ^1.17 through one barrel | [shared/icons/index.ts](src/shared/icons/index.ts) |
| Motion | `framer-motion` ^12 (22 files) + hand-rolled CSS keyframes | [tailwind.config.ts:31-89](tailwind.config.ts#L31-L89) |
| Charts | `recharts` ^3.8 behind a shared barrel | [shared/charts/index.tsx](src/shared/charts/index.tsx) |
| Flow diagrams | `@xyflow/react` ^12 + `dagre` (policies / salary builder / role hierarchy) | [globals.css:420-424](src/app/globals.css#L420-L424) |
| 3D | `@react-three/fiber` + `drei` (login artwork only) | [app/login/](src/app/login/) |

### 1.1 The four places a style can come from

1. **Tailwind utilities in JSX** — ~95% of all styling. The default. Use it.
2. **Global CSS in `globals.css`** — tokens + keyframes (**live, keep**) and a ported CRM-V2
   "HR design system" (**~85% dead — do not add to it**, see §16).
3. **Exported class-string constants** — for surfaces needing pixel-stable identity across
   routes: [`billing/bill-tokens.ts`](src/components/billing/bill-tokens.ts) (`SJ_*`),
   [`page-primitives.tsx`](src/components/page/page-primitives.tsx) (`HERO_*_BTN`),
   [`dashboard/SpotlightCard.tsx`](src/app/dashboard/SpotlightCard.tsx) (`DASH_*`).
   **This is the pattern to reach for** when two files must look identical.
4. **Module-scoped geometry constants** — numbers that must agree across components, exported
   as plain JS: `GUTTER`/`COLLAPSED_W`/`EXPANDED_W`/`ICON_SLOT` in `Sidebar.tsx`,
   `PAPER_W`/`PAPER_H` in `invoice-pdf.ts`, `EXIT_MS` in `project-overlay-kit.tsx`.

---

## 2. Design DNA

> **Indigo + violet accents on a hueless white-grey canvas, navy ink, DM Sans, heavy weights,
> generous radii, whisper-light shadows, floating chrome. Light mode only.**

Seven principles the codebase actually holds to:

1. **Floating chrome, deeper canvas.** The rail and the top bar are *cards* lifted off the page
   — same surface (`--n2b-chrome`), same radius family, same two-layer shadow, same 18px inset.
   The canvas sits one step deeper (`#f4f4f5`) so no border is needed to separate them.
2. **The tint lives in the background, never the ink.** Chrome surfaces are white + 4% indigo.
   Text and glyphs on them stay slate/near-black. The canvas stays hueless on purpose.
3. **Calm Canvas vs Premium Moment.** Data surfaces (tables, lists, forms) are flat white on
   canvas with hairline borders. Expressiveness is rationed to *heroes*, *KPI tiles*,
   *primary CTAs*, and *exported documents*. Never both in the same box.
4. **Colour carries meaning, not decoration.** Indigo = brand/primary action. Emerald =
   money-in / approved / done. Rose = destructive / rejected / overdue. Amber = pending /
   attention. Slate = everything neutral. On the dashboard, colour narrows further: it lands
   on the **glyph** only, never on the chip behind it.
5. **Weight is the hierarchy, not size.** Body is almost always `text-sm`/`text-xs`; hierarchy
   comes from `font-black` → `bold` → `semibold` → `medium` and from slate shade (900 → 400).
6. **No hover lift, no glow.** Rows and cards recolour, or deepen the *same neutral* shadow.
   They do not translate, scale, or emit a purple bloom. (Explicit user rule; a handful of
   legacy tiles still violate it — §17.)
7. **Light only.** `darkMode: "class"` and *nothing ever gets the `dark` class*. The strategy
   was chosen so the ui-kit's baked-in `dark:` variants stay inert on dark-mode OSes — under
   the default `media` strategy they painted white-on-white.

---

## 3. Colour system

### 3.1 Root tokens — three families coexist

**(a) Shell / chrome tokens** — *new, and the ones you'll actually touch:*

```css
--background:        #f4f4f5;  /* the app canvas — deliberately HUELESS       */
--foreground:        #0f172a;  /* slate-900 — default ink                     */
--n2b-chrome:        #f6f6fe;  /* rail + top bar surface (≈96% white/4% indigo) */
--n2b-chrome-hover:  #efeffb;  /* nav row hover                               */
--n2b-chrome-active: #e8e8f7;  /* nav row settled/active fill                 */
--n2b-sb:            86px;     /* shell left margin — rewritten by Sidebar    */
```

> Change `--n2b-chrome` and **both** pieces of chrome move together. That is the point of the
> token. Do not hard-code `#f6f6fe`; write `bg-[var(--n2b-chrome)]` (8 call sites do).
> `--n2b-sb` is declared on `:root` so the very first paint — before the rail hydrates — is
> already correctly offset; the Sidebar then rewrites it on `documentElement`.

**(b) Functional / shadcn tokens** (mapped into Tailwind as `bg-card`, `text-muted-foreground`, …):

```css
--card: oklch(1 0 0);              --popover: oklch(1 0 0);
--primary: oklch(0.2 0 0);         /* ⚠ NEAR-BLACK, not indigo */
--secondary: oklch(0.955 0.008 250);
--muted: oklch(0.96 0.004 247);    --muted-foreground: oklch(0.52 0.02 250);
--destructive: oklch(0.577 0.245 27.325);
--border: oklch(0.82 0 0);         --input: oklch(0.82 0 0);
--ring: oklch(0.55 0 0);           /* deliberately NEUTRAL grey — no blue focus */
--radius: 0.625rem;                /* 10px */
```

> **`--primary` is near-black.** Anything reading `bg-primary` / `text-primary` renders
> *charcoal*, not indigo: `Badge variant="default"`, `Progress`'s indicator, `Switch`'s checked
> state, `Button variant="link"`. `Button variant="default"` escapes it only because it
> hard-codes the gradient. For brand indigo write `indigo-600` or `text-primary-indigo` —
> **never** `text-primary`.
>
> The `--sidebar-*` token block (8 vars) is **dead**: the rebuilt rail uses `--n2b-chrome`
> and slate literals. Nothing reads `bg-sidebar` / `text-sidebar-foreground`.

**(c) Premium Moment tokens** — expressive layer, hero/export surfaces only:

```css
--color-primary: #4f46e5;   --color-primary-strong: #4338ca;  --color-primary-soft: #eef2ff;
--color-secondary: #7c3aed; --color-secondary-alt: #9333ea;   --color-secondary-soft: #f5f3ff;
--gradient-primary: linear-gradient(135deg, #4f46e5, #9333ea);
--glow-indigo: 0 18px 44px -16px rgba(79,70,229,0.45);
--shadow-hero: 0 2px 4px rgba(15,23,42,0.05), 0 18px 44px -16px rgba(79,70,229,0.28);
--premium-paper: #fbf5f0;   --premium-blush: #fbd5bd;   --premium-periwinkle: #8a83da;  …
--radius-sm…3xl: 0.75rem … 2rem;   --radius-pill: 999px;
```

> The `--premium-*` palette and the `--glow-*` / `--shadow-hero` trio are **referenced by
> nothing in JSX**. They are documentation of an intended layer, not a live system. Treat them
> as a proposal; if you build a Premium Moment surface, wire them or delete them.

### 3.2 Named brand colours (tailwind.config.ts)

| Token | Hex | Measured uses | Verdict |
|---|---|---|---|
| `navy` | `#1E3A5F` | `text-navy` **555** · `bg-navy` 3 | **The heading colour.** Correct |
| `primary.indigo` | `#4F46E5` | `text-` 187 · `bg-` 31 | Correct |
| `primary.blue` | `#3B82F6` | `text-` 26 · `bg-` 5 | **Legacy** — HR subnav only. Do not use |
| `success` | `#16A34A` | 4 | Rare; prefer `emerald-600` |
| `warning` | `#F59E0B` | ~2 | Rare; prefer `amber-500` |
| `danger` | `#DC2626` | ~30 | Mostly in `bill-tokens` |
| `info` | `#0EA5E9` | **0** | **Dead token — delete** |

### 3.3 The real palette, by measured usage

Counts are occurrences of `{bg,text,border,ring,from,to,via,divide,fill,stroke,…}-{hue}-{n}`
across `src/**/*.{ts,tsx}`.

```
slate   5795  ██████████████████████████  canvas, borders, all neutral text
indigo  3000  ██████████████              brand, primary action, active state
emerald 1233  █████                       success / paid / approved / done
rose    1147  █████                       destructive / rejected / overdue
gray    1082  █████                       ⚠ LEGACY duplicate of slate (HR pages)
amber    865  ████                        pending / warning / attention
violet   566  ██                          hero-gradient partner, "Service" kind
blue     218  █                           ⚠ LEGACY (primary-blue era)
red      164  █                           ⚠ LEGACY duplicate of rose
orange   112                              amber gradient tail, chart series
purple    88                              gradient tail only (from-indigo→to-purple)
teal      87                              emerald gradient tail, chart series
sky       71                              chart series, one-off accents
green     57                              ⚠ LEGACY duplicate of emerald
cyan 33 · pink 26 · fuchsia 22 · yellow 4 — chart series & one-offs
zinc / neutral / stone / lime — 0 (unused)
```

**Four hues are legacy duplicates:** `gray`→`slate`, `blue`→`indigo`, `red`→`rose`,
`green`→`emerald`. They survive in `/hr/**`, `/analytics`, and older modals. **Never mix a
legacy hue and its modern twin in the same component** — they differ enough to read as a bug.

### 3.4 Neutral shade ladder (the one you'll reach for)

| Role | Class | Uses | Notes |
|---|---|---|---|
| Page canvas | `bg-background` | 63 | `#f4f4f5` — **not** `bg-slate-50` any more |
| Chrome surface | `bg-[var(--n2b-chrome)]` | 8 | rail + top bar only |
| Card surface | `bg-white` | 1174 | always |
| Well / inset / table zebra | `bg-slate-50/60` … `/80` | 91 | ⚠ see §17.1 |
| Hairline divider | `border-slate-100` | — | inside a card |
| Card border | `border-slate-200/70` (126) or `border-slate-200` (818) | — | `/70` is the modern one |
| Heading ink | `text-navy` | 555 | `#1E3A5F` |
| Strong body | `text-slate-700` | 225 | |
| Body | `text-slate-600` | 353 | |
| Secondary / caption | `text-slate-500` | 814 | |
| **Label / eyebrow / meta** | `text-slate-400` | **1086** | **most-used single colour class** |
| Disabled / placeholder | `text-slate-300` | — | |

### 3.5 Indigo ladder

| Class | Uses | Use |
|---|---|---|
| `bg-indigo-50` | 654 | soft tint behind an active/branded chip, panel, icon tile |
| `text-indigo-600` | 453 | brand text, icons, links |
| `bg-indigo-600` | 153 | solid primary button fill |
| `text-indigo-700` / `#4338ca` | — | headings on branded surfaces, bill pages |
| `border-indigo-100 / -200` | — | branded hairline |
| `ring-indigo-500/20` | — | focus ring on branded inputs |
| `from-indigo-600 to-purple-600` | — | **the** primary CTA gradient (`Button`, `SJ_BTN_PRIMARY`) |
| `from-indigo-600 to-violet-600` | — | the hero/header CTA gradient (`HERO_PRIMARY_BTN`) |
| `from-indigo-500 to-indigo-700` | — | **identity avatars only** — header chip + sidebar profile + dropdown |

> Two gradients do the same job: `to-purple-600` `#9333ea` vs `to-violet-600` `#7c3aed`. Close
> but not identical. Match whichever the surrounding surface already uses; do not introduce a third.

### 3.6 Semantic tone map

The de-facto soft badge/panel is **`bg-{tone}-50 text-{tone}-700`**, with
`border-{tone}-200/70` when it is a panel. Used by `ConfirmActionDialog`, `FormBanner`,
`HRBadge`, `SJ_TONE`, and dozens of status pills.

| Meaning | Tone | Badge | Solid button |
|---|---|---|---|
| Success / paid / approved / completed | emerald | `bg-emerald-50 text-emerald-700` | `bg-emerald-600 hover:bg-emerald-700` |
| Pending / partial / draft / warning | amber | `bg-amber-50 text-amber-700` | `bg-amber-500 hover:bg-amber-600` |
| Destructive / rejected / overdue / cancelled | rose | `bg-rose-50 text-rose-700` | `bg-rose-600 hover:bg-rose-700` |
| Info / sent / in-progress / brand | indigo | `bg-indigo-50 text-indigo-700` | `bg-indigo-600 hover:bg-indigo-700` |
| Neutral / inactive / N/A | slate | `bg-slate-100 text-slate-600` | `bg-white border-slate-200 text-slate-700` |
| "Service" catalog kind | violet | `bg-violet-50 text-violet-700` | — |
| "Product" catalog kind | indigo | `bg-indigo-50 text-indigo-700` | — |
| **Not the current fiscal year** | amber | `border-amber-300 bg-amber-50 text-amber-700 ring-1 ring-amber-200` | — |
| **Live / present / online** | emerald | `bg-emerald-400` dot, `border-2 border-white` | — |

---

## 4. Typography

### 4.1 Families

```ts
// tailwind.config.ts — only `sans` is extended
sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"]
```

* **DM Sans** — everything. Loaded via `next/font` at **build time** and self-hosted under
  `/_next/static`, so there are zero runtime requests to Google (required for the static
  export, offline use, and a strict CSP). Variable font: all weights, one woff2.
* **Geist Mono** is loaded (`--font-geist-mono`, [app/fonts/](src/app/fonts/)) but **never
  wired into `fontFamily`**. `font-mono` compiles to the stock stack —
  `.font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,…}` **[verified-in-CSS]**. Either
  wire it up or drop the file; right now it ships bytes for nothing.
* **Font Awesome** — a subsetted `fontawesome-subset.css` is imported globally and used by
  **71** legacy `<i className="fas fa-…">` call sites in `/hr/**` and `/expenses/**`. New work
  uses lucide.

### 4.2 Scale (measured)

| Class | Uses | Role |
|---|---|---|
| `text-sm` | 1458 | **default body** |
| `text-xs` | 1403 | labels, meta, table cells, badges |
| `text-[11px]` | **846** | dense meta — effectively a first-class size |
| `text-[10px]` | **602** | eyebrows, uppercase micro-tags |
| `text-lg` | 149 | modal titles, card titles |
| `text-base` | 136 | section titles |
| `text-[9px]` | 105 | stat captions, role sub-labels |
| `text-[13px]` | 102 | dense body — the chrome's body size |
| `text-2xl` | 84 | page H1 |
| `text-xl` | 80 | KPI values, sub-hero |
| `text-3xl` | 58 | page H1 at `sm:` and up |
| `text-4xl`/`5xl` | 4 / 1 | login artwork only |

Arbitrary micro-sizes are **idiomatic here, not a smell** — `text-[11px]` and `text-[10px]`
together outnumber every named size except `text-sm`/`text-xs`. The shell adds two more:
`text-[13.5px]` (nav row) and `text-[15px]` (active breadcrumb).

Fluid sizing appears exactly twice, both on heroes:
`text-[clamp(1.6rem,3.4vw,2.4rem)]` (dashboard) and `clamp(1.25rem,3vw,1.75rem)` (`.page-title`, dead).

### 4.3 Weight (measured)

`font-bold` 1645 · `font-semibold` 1031 · `font-medium` 795 · `font-black` 458 ·
`font-extrabold` 175 · `font-normal` 36

This app is **heavy by default**. A plain `<p>` of body copy is `font-medium` at minimum;
labels are `font-bold`; anything numeric and important is `font-black`.

**Exception — the shell is light.** The rail deliberately inverts the app's habit: idle nav
rows are `font-normal text-slate-500`, active is only `font-medium text-slate-900`. Do not
"fix" this to `font-bold`; the calm is the design.

### 4.4 The six canonical text recipes

```tsx
// Page H1 (inside a PageHero)
"text-2xl font-black tracking-tight text-navy sm:text-3xl"

// Page H1 (dashboard glass hero — lighter, fluid, slate not navy)
"text-[clamp(1.6rem,3.4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] text-slate-900"

// Section / card title
"text-base font-bold text-navy"                 // or "text-sm font-bold"

// Eyebrow / uppercase micro-label  ← the signature N2B detail
"text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
"text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"   // dashboard variant

// Body
"text-sm text-slate-600"                        // "text-[13px] font-medium" when dense

// Numeric value (ALWAYS tabular)
"text-xl font-black tabular-nums text-navy"
```

**`tabular-nums` is mandatory on any number that sits in a column or animates** — money,
counts, dates, percentages. 301 occurrences across 106 files. Without it, digits jitter.

### 4.5 Tracking

`tracking-wider` 399 · `tracking-wide` 183 · `tracking-tight` 121 · `tracking-widest` 82 ·
`tracking-normal` 21, plus arbitrary `[0.14em]` 26 · `[0.2em]` 23 · `[0.1em]` 17 ·
`[0.16em]` · `[0.12em]` · `[0.18em]`.

Rule: **uppercase always gets tracking**; large headings get `tracking-tight` or
`tracking-[-0.02em]`; body gets none.

---

## 5. Layout & spacing

### 5.1 The app shell — floating chrome

[`AuthWrapper`](src/components/layout/AuthWrapper.tsx#L369-L385) owns the frame:

```
<div class="flex h-screen w-full overflow-hidden bg-background">   ← #f4f4f5 canvas
  <RouteTransitionIndicator/>                                       ← top progress bar
  <Sidebar/>                                                        ← fixed z-50 floating CARD
  <div class="ml-0 flex min-w-0 flex-1 flex-col overflow-hidden
              transition-[margin] duration-[260ms]
              ease-[cubic-bezier(0.32,0.72,0,1)]
              lg:ml-[var(--n2b-sb)]">                               ← 86px / 290px
    <AppHeader/>                                                    ← floating rounded BAR
    <main class="flex-1 overflow-y-auto">   ← ★ THE SCROLL CONTAINER (not <body>)
      {routeDenied ? <NoAccessPlaceholder/> : children}
    </main>
  </div>
</div>
```

**Three shell facts that break code if you forget them:**

1. **`<main>` is the real scroll container, not the document.** Anything that locks scroll,
   measures the scrollbar gutter, or positions a `fixed` overlay must account for it — see
   [`useOverlayLock`](src/components/projects/project-overlay-kit.tsx#L44-L82), which freezes
   *both* `<body>` and `<main>` and pads back the scrollbar width so the page doesn't jolt
   sideways when a modal opens.
2. **The left margin is `lg:ml-[var(--n2b-sb)]`, and only the *pinned* width counts.** A
   hover-expand overlays the content deliberately: a cursor passing over the rail must never
   reflow the page. The margin transition uses the shell's shared 260ms curve so pinning reads
   as one gesture with the rail.
3. **`--n2b-sb` has a static default (86px).** The first paint is correct before the rail
   hydrates. `ShellBootSkeleton` mirrors the same geometry (`inset-y-[18px] left-[18px]`,
   `w-[68px]`, `rounded-[26px]`, `h-[54px]` bar) so the boot state does not jump.

Printable routes bypass the shell entirely — no rail, no bar:
`/invoices/receipt`, `/invoices/download`, `/leads/proposal`, `/proposals/download`.
`/login` renders pre-mount so its static HTML paints before any JS hydrates.

### 5.2 The chrome frame — one shared geometry

```ts
// Sidebar.tsx — the single source of truth
const GUTTER      = 18;                 // inset on left/top/bottom; also 2×GUTTER shorter than the viewport
const COLLAPSED_W = 68;
const EXPANDED_W  = 272;
const ICON_SLOT   = COLLAPSED_W - 24;   // 44px → w-11 (card px-3 = 12px each side)
```

`AppHeader` pads itself by the **same 18px** (`sm:px-[18px] sm:pt-[18px]`, tightening to 12px
below `sm` where the rail is a drawer and the pixels are free). Both surfaces carry
`max-w-[1760px]`, so a page wrapper using that width lines its card edges up with the header
card above it. `/dashboard` is the only page that does this today.

> **If you change `GUTTER`, change `AppHeader`'s padding in the same commit.** They are two
> literals expressing one number, and nothing enforces it.

### 5.3 Page wrapper

There is no single component; the convention is a wrapper div. Dominant forms:

```tsx
// Most common (15 uses)
<div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">

// Wide — project detail, dense tables (14 uses)
<div className="max-w-[1600px] mx-auto p-4 sm:p-6 md:p-8 space-y-6">

// Chrome-aligned — matches the header card exactly (dashboard only)
<div className="mx-auto w-full max-w-[1760px] space-y-6 px-[18px] pb-8 pt-2.5">

// Compact / forms
<div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
```

Max width: `1500px` (15) and `1600px` (14) are the two established choices; `1760px` (3) is
the new chrome-aligned one. Vertical rhythm between page sections: **`space-y-6`** (72 uses)
or `space-y-5` (74) — equally common; pick per page and stay consistent within it.

### 5.4 Spacing scale in practice

`gap-2` 996 · `gap-3` 706 · `gap-1.5` 693 · `gap-1` 329 · `gap-4` 270 · `gap-2.5` 200 ·
`gap-5` 71 · `gap-6` 69
`p-4` 267 · `p-6` 191 · `p-5` 119 · `p-3` 107 · `p-8` 72

| Context | Value |
|---|---|
| Icon ↔ label inside a button/badge | `gap-1.5` or `gap-2` |
| Items in a toolbar / action row | `gap-2` / `gap-3` |
| Chrome action cluster | `gap-1.5 sm:gap-2` |
| Cards in a grid | `gap-4` (tight) · `gap-5` · `gap-6` |
| Page sections | `space-y-5` / `space-y-6` |
| Card internal padding | `p-4` (compact) · `p-5` (default) · `p-6` (roomy) |
| PageHero padding | `px-6 py-6 sm:px-8` |
| Glass hero padding | `px-6 py-7 sm:px-9 sm:py-8` |

### 5.5 Grid

`grid-cols-2` 302 · `grid-cols-1` 220 · `grid-cols-3` 115 · `grid-cols-4` 68 ·
`grid-cols-6` 10 · `grid-cols-7` 9 (calendar weeks)

* Canonical KPI row: `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`
* Dashboard KPI row: 6 cards, `sm:grid-cols-2 lg:grid-cols-3` (4 for personal views)
* Canonical two-column detail: `lg:grid-cols-4` with a `lg:col-span-1` rail +
  `lg:col-span-3` content — the ¼ / ¾ split `/clients/detail` uses (explicit user preference).

### 5.6 Breakpoints

`sm:` 1221 · `lg:` 329 · `md:` 173 · `xl:` 104 · `2xl:` 8

**`sm:` (640px) does the heavy lifting** — this app is desktop-first with a mobile fallback,
and `sm:` is where "phone → everything else" flips. **`lg:` (1024px) is the shell breakpoint**:
above it the rail is a reserved column and the shell margin applies; below it the rail is a
drawer and `ml-0` wins. Every chrome control that folds away folds at `sm:`
(breadcrumb parents, FY label, identity chip, dividers) or `lg:` (hamburger, pin button).

---

## 6. Radius

`rounded-full` 1030 · `rounded-lg` 950 · `rounded-xl` 929 · `rounded-2xl` 434 ·
`rounded-md` 193 · `rounded-3xl` 81 · `rounded-none` 8 · `rounded-sm` 5

Arbitrary: `rounded-[26px]` 8 · `rounded-[18px]` 8 · `rounded-[28px]` 5 · `rounded-[20px]` 4 ·
`rounded-[12px]` 4 · `rounded-[24px]` 3 · `rounded-[11px]` 2

| Element | Radius |
|---|---|
| Pills, badges, avatars, status dots, icon-only circle buttons, **all chrome controls** | `rounded-full` |
| Inputs, selects, small buttons, dropdown items, **nav rows** | `rounded-xl` (12px) — was `rounded-lg` |
| Cards, panels, icon tiles, search fields, compact modals | `rounded-xl` (12px) |
| Content cards, table wrappers, dialogs, stat cards | `rounded-2xl` (16px) |
| Page heroes (`PageHero`), meeting modals | `rounded-3xl` (24px) |
| **Floating chrome + glass cards + glass hero** | **`rounded-[26px]`** |
| **Floating top bar** | **`rounded-[20px]`** |
| Bill/document pages | `rounded-[24px]` card · `rounded-[28px]` document · `rounded-[18px]` input |

> **New radius language.** `26px` is now the shell's signature: rail, glass cards, glass hero,
> boot skeleton. The bar is `20px` because it is shorter (54px tall) and 26 would read as a
> lozenge. Use `26px` for anything that must belong to the floating-chrome family, `2xl`/`3xl`
> for ordinary page cards.

> ⚠ **`rounded-4xl` does not exist in Tailwind 3** and is used by
> [`badge.tsx`](src/components/ui/badge.tsx#L8) **[verified absent from compiled CSS]** — the
> base `Badge` renders with *square corners*. Every hand-rolled badge uses `rounded-full`
> instead, which is why nobody noticed. Fix to `rounded-full`.

---

## 7. Elevation

`shadow-sm` 619 · `shadow-lg` 133 · `shadow-md` 124 · `shadow-xl` 63 · `shadow-2xl` 59 ·
`shadow-none` 26 · `shadow-inner` 9

Elevation is **very** restrained: a hairline border does the work and `shadow-sm` adds a
whisper of lift.

### 7.1 The chrome shadow — now the canonical lift

```
0 1px 2px      rgba(15,23,42,0.04)      ← tight contact shadow
0 12px 40px -16px rgba(15,23,42,0.18)   ← wide soft ambient
```

One string, four surfaces: **sidebar rail, top bar, dashboard glass cards, dashboard hero**
(plus `ShellBootSkeleton`). Two escalations:

| State | Shadow |
|---|---|
| Rail hover/pin-expanded | `0 1px 2px rgba(15,23,42,0.05), 0 24px 60px -20px rgba(15,23,42,0.28)` |
| Glass card hover | `0 1px 2px rgba(15,23,42,0.05), 0 20px 52px -18px rgba(15,23,42,0.26)` |

Both are **the same neutral slate, deepened** — never a hue. That is the whole hover
vocabulary for glass: `transition-shadow duration-300`, no lift, no scale, no bloom.

### 7.2 The full ladder

| Level | Recipe | Use |
|---|---|---|
| 0 | `border border-slate-200/70` | inline panels, wells |
| 1 | `border border-slate-200/70 bg-white shadow-sm` | **the default card** |
| 1-ring | `bg-card ring-1 ring-black/10` | the `Card` primitive's own style |
| **Chrome** | the two-layer string above | rail, bar, glass cards, glass hero |
| 2 | `shadow-lg` | dropdowns, popovers, floating tiles |
| 3 | `shadow-xl` | select popups (`shadow-xl shadow-slate-900/8`), profile dropdown |
| 4 | `shadow-2xl` | modal panels, `richToast` |
| Brand | `shadow-lg shadow-indigo-500/25` | the primary gradient CTA **only** |
| Document | `shadow-[0_2px_12px_rgba(35,38,47,0.05)]` | bill/proposal papers |
| Inset | `shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]` | segmented tab rails |
| Micro | `shadow-[0_2px_8px_-2px_rgba(15,23,42,0.16)]` | the rail's pin chevron |

**Coloured shadows are reserved for the primary CTA.** `shadow-indigo-500/25` on a card is
exactly the "purple glow" the user rejected. The old `shadow-[8px_0_32px_rgba(0,0,0,0.08)]`
sidebar shadow is gone — the rail floats now, it does not cast sideways.

---

## 8. Component catalogue

### 8.1 The Sidebar rail — read this before touching it

[src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) · 984 lines · the most
carefully-tuned file in the repo.

**Shape.** `fixed z-50`, `top/bottom/left: 18px`, `rounded-[26px]`,
`bg-[var(--n2b-chrome)]`, chrome shadow, **no border**.
Desktop width `lg:w-[var(--rail-w)]` — 68px collapsed, 272px expanded.
Mobile: a **fixed** `w-[272px] max-w-[calc(100vw-36px)]` drawer that only ever
`translate-x`-slides (`-translate-x-[120%]` → `0`).

> **Why width is a CSS var and not an inline `width`.** Previously the mobile drawer animated
> 68→272px *at the same time* as its slide-in, so the panel visibly grew while it travelled.
> Handing the desktop width to CSS lets the mobile drawer keep a fixed width.

**Expansion.** `expanded = pinned || hovered || mobileOpen`. Pin state persists in
`localStorage["n2b_sidebar_pinned"]`, is read **lazily in the `useState` initializer** (not an
effect — `setState`-in-effect is an eslint **error** in this repo, and the rail is a
client-only dynamic import so there is no hydration pass to mismatch).

**One curve, one duration, for everything:**

```ts
const CURVE      = "duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";
const EASE       = `transition-[width,transform,box-shadow] ${CURVE}`;  // the card
const EASE_INNER = `transition-[width] ${CURVE}`;                       // the search field
```

> **Never `transition-all` here.** Naming the three properties keeps 260ms of animation to one
> layout pass (width) plus two compositor-only ones. `transition-all` also animates colour,
> radius, and every property added later.

**Fixed-height slots — nothing reflows vertically as the card grows:**

| Slot | Height | Notes |
|---|---|---|
| Brand | `h-[68px] px-3` | glyph parked in the same `ICON_SLOT` as every nav icon |
| Search | `h-[52px] px-3` | field `h-10 rounded-xl border-slate-200/80 bg-white`; collapses to `w-11` |
| Group heading | `h-[18px]` | label when open, a **centered 4px hairline** when collapsed |
| Nav row | `h-10 rounded-xl` | |
| Profile card | `p-3 pt-1` | `rounded-xl border-slate-200/80 bg-white p-[5px]` |

**Nav row — monochrome by design:**

```tsx
"group relative flex h-10 w-full items-center rounded-xl text-[13.5px] outline-none
 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-slate-900/10"
// active
"bg-[var(--n2b-chrome-active)] font-medium text-slate-900"
// idle
"font-normal text-slate-500 hover:bg-[var(--n2b-chrome-hover)] hover:text-slate-900"
```

Icons are `h-[18px] w-[18px]`, `strokeWidth={active ? 1.9 : 1.6}`, `text-slate-900` active /
`text-slate-400 group-hover:text-slate-700` idle. **No border, no ring, no accent bar, no
indigo, in any state.** The old inset right-edge bar
(`shadow-[inset_-4px_0_0_#4f6df5]`) and the blue-indigo active text are gone.

**The active-row spotlight.** The active row already wears its settled fill, so hover has
nothing to change — it reads dead. `SpotlightLayer` adds a cursor-tracked light *on top*:

```
radial-gradient(110px circle at <x> <y>, rgba(139,92,246,0.07), transparent 70%)   ← violet halo
radial-gradient(210px circle at <x> <y>, rgba(99,102,241,0.04), transparent 78%)   ← indigo falloff
opacity 0 → 100 on group-hover, transition-opacity duration-[450ms]
```

Rules that make it work: pointer position is written to **CSS custom properties on the row**
(`--n2b-spot-x/y`) via `style.setProperty`, **never React state** — a `setState` per mousemove
would re-render the whole nav ~60×/s. Alphas are deliberately tiny and the falloff starts
immediately so the glow has no perceptible edge. **No white specular core** — a bright centre
made it read as a *spot riding the row*. Normal blending only: `plus-lighter`/`screen` clip to
white against this pale chrome and lose the hue. The fade is slow (450ms); a quick fade on
something this faint reads as a flicker.

**Other details worth preserving:**

* `Reveal` — one shared component for every collapsible text run (nav label, group heading,
  profile block) so the whole card reads as **one** motion. `transition-[max-width,opacity,transform]`,
  `max-w-[190px]` open / `max-w-0 -translate-x-1 opacity-0` closed, `delay-[60ms]` on the way
  *in* only, `[will-change:max-width,opacity,transform]` (without it the text re-rasterises
  every frame and shimmers).
* **No padding on the label** — `max-w-0` clips text but padding still adds real width and
  would overflow the 68px rail.
* `overflow-hidden` on the profile trigger — the name block and chevron keep their real width
  while collapsed (only opacity/max-width animate) and would otherwise spill past 68px.
* Pin chevron: `absolute -right-3 top-[26px] h-6 w-6 rounded-full border-slate-200/90 bg-white
  shadow-[0_2px_8px_-2px_rgba(15,23,42,0.16)] hidden lg:flex`.
* Nav scroller: `touch-pan-y overflow-y-auto overscroll-contain` + hidden scrollbar.
  `overscroll-contain` stops a flick past the last item from scroll-chaining into the page
  behind the mobile backdrop.
* Mobile backdrop is **always mounted** so it can fade *both* ways (conditional mounting gives
  a fade-in then a hard cut). `bg-slate-900/40 z-40 lg:hidden`, and `backdrop-blur-sm` is
  attached **only while open** — a permanently-live `backdrop-filter` costs a compositor pass
  even at opacity 0.
* Mobile drawer trigger lives in **AppHeader**, not the rail, and asks via a window event
  ([sidebar-events.ts](src/components/layout/sidebar-events.ts)).
* Brand glyph: company upload framed in a `34px rounded-[11px] bg-white ring-1 ring-slate-900/10`
  tile with `object-contain` (a wide wordmark letterboxes rather than cropping); falls back to
  the vector `<BrandMark/>` on missing/broken file.
* 9 nav groups, RBAC-filtered by `perm` slugs; the active item is resolved by **longest
  matching prefix** so `/expenses` doesn't also highlight on `/expenses/categories`.
  Route access is independently enforced in `AuthWrapper` — a hidden item cannot be URL-reached.

### 8.2 The AppHeader bar

[src/components/layout/AppHeader.tsx](src/components/layout/AppHeader.tsx)

```tsx
<header className="shrink-0 px-3 pb-2.5 pt-3 sm:px-[18px] sm:pt-[18px]">
  <div className="mx-auto flex h-[54px] w-full max-w-[1760px] items-center gap-1.5
                  rounded-[20px] bg-[var(--n2b-chrome)] px-2 sm:gap-3 sm:px-4
                  shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.18)]">
```

No border — the shadow alone lifts it. Left = breadcrumb, right = action cluster.

**Breadcrumb (not a page title).** Every page already renders its own hero/title, so the bar
shows *where you are* without duplicating it. Derived purely from the URL, so it works on
routes added later with no registration step. Three lookup layers, most specific first:

1. `PAGE_LABELS` — full path → the page's real name, used for the **last** crumb
   (`/hr` → "Employee Directory", while `/hr/attendance`'s parent reads the folder name "HR").
2. `SEGMENT_LABELS` — per-segment fixes the prettifier can't infer: `hr`→HR, `rbac`→RBAC,
   `meetings_new`→Meetings, `products-services`→"Products & Services".
3. `prettifySegment` — kebab/snake → Title Case.

**Record ids never reach the trail.** Query and hash are dropped wholesale (this app carries
`?id=` there), and `isIdSegment` filters bare numbers, uuids, and opaque tokens (≥8 chars with
a digit and no separator). Parent crumbs link only where a real page exists at that path
(`PAGE_LABELS` ∪ `LINKABLE_PARENTS`), so `/admin` and `/reports` stay plain text instead of
becoming dead links.

Type: last crumb `text-[15px] font-semibold tracking-tight text-slate-900`; parents
`text-[13px] font-medium text-slate-400 hover:text-slate-700`; separator a plain
`text-[13px] font-light text-slate-300` slash — **no chevron glyph, no icons anywhere in the
trail**. Parents are `hidden sm:flex`; the page you are on always survives.

**Action cluster** (right → left it reads: identity · divider · notifications · check-in/out ·
chat · divider · FY switcher):

| Control | Recipe |
|---|---|
| Circular action button | `h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-500` → hover `border-indigo-300 bg-indigo-50 text-indigo-600` |
| FY switcher (current FY) | `h-10 rounded-full border-slate-200 bg-white text-slate-600 hover:border-indigo-300`, `SelectValue` `hidden sm:flex` |
| FY switcher (past FY) | `border-amber-300 bg-amber-50 font-semibold text-amber-700 ring-1 ring-amber-200` |
| Divider | `mx-0.5 hidden h-7 w-px bg-slate-200/80 sm:block` |
| Identity chip | `rounded-full border-slate-200 bg-white py-1 pl-1 pr-3.5`, `hidden sm:flex` |
| Identity avatar | `h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[13px] font-bold text-white` + `h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400` presence dot |
| Mobile hamburger | `h-9 w-9 rounded-full … lg:hidden`, **inside** the bar |

> The hamburger is inside the bar on purpose: as a `fixed` button at the same 18px inset it
> landed straight on top of the breadcrumb.
>
> The identity chip folds away below `sm` — at phone widths the bar can't seat it without
> starving the breadcrumb, and `/profile` is one tap away in the drawer.

### 8.3 `PageHero` + `SpotlightStatCard` — the standard page top

[page-primitives.tsx](src/components/page/page-primitives.tsx) · `PageHero` in 10 files,
`SpotlightStatCard` in 8, plus `ExpensesHeader` (a near-verbatim copy) in 6.

```tsx
<div className="relative overflow-hidden rounded-3xl border border-slate-200/70
                bg-gradient-to-br from-white via-indigo-50/80 to-violet-50
                px-6 py-6 shadow-sm sm:px-8">
  {/* two blurred orbs — pointer-events-none, purely decorative */}
  <div className="pointer-events-none absolute -top-20 -right-8 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
  <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl" />

  <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100
                       bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase
                       tracking-[0.2em] text-indigo-600">
        <Icon className="h-3 w-3" /> {badge}
      </span>
      <h1 className="mt-2.5 text-2xl font-black tracking-tight text-navy sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    <div className="flex items-center gap-3">{actions}</div>
  </div>
</div>
```

> **This wash — `from-white via-indigo-50/80 to-violet-50` + the two orbs at exactly these
> offsets — is the app's hero signature.** It is duplicated verbatim in `/my-work` (twice),
> `/hr`, and `DASH_HERO_WASH`. If you change it, change all four or it stops reading as one system.

Hero action buttons (exported as class strings so a `<button>` and a `<Link>` look identical):

```ts
HERO_PRIMARY_BTN   = "group/btn inline-flex items-center gap-2 rounded-2xl
                      bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5
                      text-sm font-black text-white shadow-lg shadow-indigo-500/25
                      transition-all hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100"
HERO_SECONDARY_BTN = "inline-flex items-center gap-2 rounded-2xl border border-slate-200
                      bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-sm
                      transition-colors hover:bg-slate-50"
```

**`SpotlightStatCard`** — white `rounded-2xl border-slate-200/70 p-5` card, `h-12 w-12
rounded-2xl` gradient icon tile, `text-[10px] font-black uppercase tracking-widest text-slate-400`
label, `text-xl font-black tabular-nums text-navy` value. 8 colour keys
(`indigo violet emerald teal amber rose slate sky`); each maps to `{grad, soft, ring, spot}`
where `spot` is the accent's 500 shade as raw `"R, G, B"` (Tailwind gradient classes can't be
inlined into a dynamic `radial-gradient`).

* The cursor-following glow writes `--spot-x`/`--spot-y` on the element — **no React state**,
  so hovering doesn't re-render.
* Clickable cards render a real `<button>` (with a `Filter`/`● On` tag); static ones render a
  `<div>` so the hover spotlight still fires (disabled buttons don't emit mousemove).
* `variant="bold"` swaps the cursor glow for a static right-edge accent glow plus a faint
  `h-20 w-20` icon watermark at 7% alpha, and drops the hover translate.
* ⚠ The **default** variant still does `hover:-translate-y-0.5` — a standing violation of the
  no-lift rule (§17.6).

### 8.4 The dashboard glass layer

[app/dashboard/SpotlightCard.tsx](src/app/dashboard/SpotlightCard.tsx) — a **self-contained
surface system**, used only by `/dashboard` (+ `shared/components/loading.tsx`). Do not import
`DASH_*` into other pages, and do not import `SpotlightStatCard` into the dashboard.

```ts
GLASS_BASE = "relative isolate overflow-hidden rounded-[26px]
              border border-white/70 backdrop-blur-xl ring-1 ring-slate-900/[0.04]
              shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.18)]"

DASH_SURFACE        = GLASS_BASE + "bg-white/75"                        // CLEAR glass — the 6 KPI cards ONLY
DASH_SURFACE_TINTED = GLASS_BASE + "bg-gradient-to-br from-white/85 via-indigo-50/60 to-indigo-100/55"
DASH_SURFACE_HOVER  = "transition-shadow duration-300
                       hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_20px_52px_-18px_rgba(15,23,42,0.26)]"
DASH_HERO_WASH      = "bg-gradient-to-br from-white via-indigo-50/80 to-violet-50"
DASH_TILE           = "bg-slate-100/70 ring-1 ring-inset ring-white/80"   // icon chip FILL — frosted, never accent
DASH_ROW            = "rounded-2xl bg-white/60 ring-1 ring-inset ring-slate-900/[0.045]
                       transition-colors duration-200 hover:bg-white/95"
```

**Five hard rules on this page:**

1. **Every card is tinted glass EXCEPT the six overview KPI cards**, which stay clear so their
   numbers carry the row.
2. **Colour lands on the GLYPH, never on the chip.** `DASH_TILE` is frosted neutral; the icon
   inside it gets `ICON_TONE[accent]` — a full static class from a `Record` (`text-indigo-500`,
   `text-violet-500`, `text-emerald-500`, `text-amber-500`, `text-rose-500`). No gradient tiles,
   no coloured chips.
3. **The shadow is neutral slate.** No indigo/violet bloom behind a card, ever.
4. **Hover deepens the same neutral lift.** No lift, no scale, no colour, no cursor spotlight
   (the glow was removed — `spotlightColor`/`intensity`/`radius` survive as `@deprecated`
   no-op props for call-site compatibility).
5. **Every card carries a glass edge-light:** `pointer-events-none absolute inset-x-8 top-0
   h-px bg-gradient-to-r from-transparent via-white to-transparent`.

KPI card anatomy: `h-[152px] p-5 flex-col justify-between` → frosted `h-11 w-11 rounded-full`
glyph chip on top (hover `group-hover:bg-slate-200/70`), then
`text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400` label, number last in a
**fixed line box** (currency renders a step smaller, and without the fixed box the label would
sit at a different height on currency cards and the row would read ragged).

Glass hero: `rounded-[26px] border-slate-200/70 px-6 py-7 sm:px-9 sm:py-8` + `DASH_HERO_WASH`
+ the two standard orbs + chrome shadow. Chips inside it are frosted
(`border-white/70 bg-white/70 backdrop-blur-md`) — **never** an indigo or gradient tile. The
"today" chip reuses the same `bg-emerald-400` presence dot as the header and rail identity
chips, with an `animate-ping` halo, so the whole chrome reads as one system.

### 8.5 Buttons

Three button systems coexist. Pick by context:

| System | Where | Default look |
|---|---|---|
| `<Button>` primitive ([button.tsx](src/components/ui/button.tsx)) | dialogs, dense toolbars | `h-8 rounded-lg`, **indigo→purple gradient** |
| `HERO_*_BTN` | page heroes | `rounded-2xl py-2.5`, gradient + `shadow-indigo-500/25` |
| `SJ_BTN_*` ([bill-tokens](src/components/billing/bill-tokens.ts)) | `/invoices/detail`, `/proposals/detail` | `rounded-full` pills, `h-8`/`h-10` |

`<Button>` variants: `default` (indigo→purple gradient) · `outline` · `secondary` · `ghost` ·
`destructive` (**tinted, not solid**: `bg-destructive/10 text-destructive`) · `link`.
Sizes: `xs`(h-6) `sm`(h-7) `default`(h-8) `lg`(h-9) `icon`(size-8) `icon-xs` `icon-sm` `icon-lg`.

> **Three gotchas.** (1) `Button` is a base-ui component, **not** `React.forwardRef` — to style
> a `<Link>` like a button use the exported `buttonVariants({variant, size})` class string, not
> `<Button asChild>`. (2) Retone the default with `from-*`/`to-*` (e.g.
> `from-emerald-600 to-emerald-700`), **never** `bg-*` — `bg-*` loses to the gradient.
> (3) Its focus ring uses `focus-visible:ring-3`, which **does not exist in Tailwind 3**
> **[verified absent from compiled CSS]** — the ring never paints. So do the
> `has-data-[…]`/`in-data-[…]` size variants (Tailwind-v4 syntax).

Hand-rolled buttons (the majority in page code):

```tsx
// Primary
"inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600
 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all"
// Secondary
"inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2
 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
// Tertiary / ghost
"rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
// Destructive
"rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700"
// Chrome / circular icon action
"flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white
 text-slate-500 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
```

### 8.6 Badges & pills

**Do not use the `Badge` primitive** unless you need its `render` prop — its `default` variant
is near-black (§3.1) and its radius is dead (§6). The house pill:

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1
                 text-xs font-bold text-emerald-700">
```

Variants in the wild: `text-[10px] font-bold` micro-tags (`ServiceKindBadge`),
`SJ_BADGE` = `h-6 px-3 text-xs font-semibold` (bill pages), `ring-1 ring-{tone}-200/70` when it
must read as a callout, and the frosted chrome chip
`border-white/80 bg-white/70 backdrop-blur-md` on glass surfaces.

### 8.7 Forms

Two input systems:

| | Primitive `<Input>` | Hand-rolled (page code) |
|---|---|---|
| Height | `h-8` | `h-9` / `h-10` / `h-11` |
| Radius | `rounded-lg` | `rounded-xl` |
| Border | `border-input` (token) | `border-slate-200` |
| Focus | `focus-visible:border-ring focus-visible:ring-3` ⚠ **dead** | `focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15` |

The dominant hand-rolled field:

```tsx
"h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900
 placeholder:text-slate-400 transition-colors
 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none"
```

Labels: `text-xs font-bold uppercase tracking-wider text-slate-500` (or `SJ_LABEL` on bill
pages). Required marker: `<span className="text-rose-600">*</span>`.

* **`SearchInput`** ([search-input.tsx](src/components/ui/search-input.tsx)) — the shared search
  field: leading `Search` icon at `left-3`, clear `×` at `right-2`, `h-9 rounded-xl`. Use it
  rather than hand-rolling another.
* **`Select`** — `@base-ui/react/select`, wrapped so `items` auto-derives from `SelectItem`
  children. Trigger `h-10 rounded-lg border-slate-200 bg-white px-4 py-3`
  (`size="sm"` → `h-8`); popup `z-[99999] rounded-xl border-slate-200 bg-white p-1.5 shadow-xl
  shadow-slate-900/8 max-w-[320px]`; selected item `bg-indigo-50 text-primary-indigo font-semibold`.
  **`SelectValue` and `ItemText` both carry `min-w-0` — load-bearing**: as flex children they
  default to `min-width:auto` and long labels push past the border instead of ellipsing.
  **Never filter `SelectItem` children out** or a pre-selected value renders as its raw id
  (e.g. `"9"`) while the popup is closed.
* Feedback: `FormBanner` (page/submit errors) + `FieldError` (inline) from
  [form-feedback.tsx](src/components/ui/form-feedback.tsx). Do not hand-roll `bg-red-50` divs.
* Never a native `<select>`, `<input type="date">`, or unstyled `<button>` — use the kit
  (`Select`, `DatePicker`/`DateTimeField`, `Button`).

### 8.8 Tables

There is no shared table component in real use — the `Table` primitive exists but pages
hand-roll `<table>`. The canonical markup (from `/expenses`, the reference implementation):

```tsx
<div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead>
        <tr className="bg-slate-50/70 border-b border-slate-100
                       text-[11px] uppercase tracking-widest text-slate-400 font-black">
          <th className="py-3.5 px-6">Category</th>
          <th className="py-3.5 px-6 hidden md:table-cell">Description</th>
          <th className="py-3.5 px-6 text-right">Amount</th>
          <th className="py-3.5 px-6 text-center w-[90px]">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm">
        <tr className="hover:bg-slate-50/70 transition-colors group">…</tr>
      </tbody>
    </table>
  </div>
</div>
```

Rules:
* Header row `bg-slate-50/70`, `text-[11px] font-black uppercase tracking-widest text-slate-400`.
* Row hover `hover:bg-slate-50/70 transition-colors` — **background only**, never lift, never a
  coloured left-border stripe.
* Dividers `divide-y divide-slate-100`. Numeric columns `text-right tabular-nums`.
* Progressive disclosure by breakpoint: `hidden sm:table-cell` / `md:` / `lg:`. **Drop a column
  before you allow a horizontal scroll on mobile.**
* Sticky headers where the table is tall: `sticky top-0 z-10 bg-white/95 backdrop-blur`.
* Mobile fallback: the `.mobile-card-list` / `.mobile-card` global classes (the one part of the
  legacy CSS that is still load-bearing — 6 files).

> ⚠ **`overflow-x-hidden` on the wrapper + `table-auto` clips the Actions column** and makes
> the buttons unreachable. If you must clip, switch to `table-fixed` with explicit `COL_W` widths.

### 8.9 Modals — three families, not interchangeable

The highest-risk area in the codebase. Read before adding a modal.
Measured: 54 files use `<DialogContent>`, 22 use `createPortal`, 16 declare `role="dialog"`.

| Family | Built on | Use when | Backdrop |
|---|---|---|---|
| **A. `Dialog`** ([dialog.tsx](src/components/ui/dialog.tsx)) | `@base-ui/react/dialog` | standard forms & confirms | `fixed inset-0 isolate z-50 bg-black/55`, self-portals |
| **B. `OverlayShell` / `ModalShell`** ([project-overlay-kit](src/components/projects/project-overlay-kit.tsx), [ModalShell](src/app/meetings_new/ModalShell.tsx)) | plain `createPortal` | **anything on `/projects/detail`, `/meetings_new`, or with a nested Radix popover** | hand-rolled `bg-black/55` |
| **C. `ModalPortal` + raw overlay** ([ModalPortal](src/app/expenses/_components/ModalPortal.tsx)) | plain `createPortal` | expenses-style pages | hand-rolled |

**Why B and C exist:** a controlled base-ui `Dialog` has a reproducible **stuck-open** failure
on `/projects/detail` and in the calls log — its controlled close never completes. It also
swallows clicks inside nested Radix popovers. When either applies, use a plain portal.

**Non-negotiable rules:**

1. **Backdrop is `bg-black/55`, no blur.** Every family. 50 of 53 `bg-black/*` occurrences
   already comply (2 × `/40`, 1 × `/70` are strays).
2. **Portal to `<body>`.** A `fixed inset-0` overlay declared as a sibling inside a
   `space-y-6` page inherits `margin-top: 1.5rem` — measured symptom: overlay at
   `top: 24, height: 648` in a 672px viewport, i.e. an un-dimmed strip at the top and a dialog
   24px below centre. Portalling fixes it; `!mt-0` is the inline patch.
3. **`z-50` minimum.** The rail is `fixed z-50`; a `z-40` backdrop paints *under* it, leaving
   the rail bright and clickable behind a supposedly modal overlay. Stacked modals (a dialog
   opened from a dialog) go `z-[60]`.
4. **Lock scroll on `<main>`, not just `<body>`** (§5.1), and pad back the scrollbar gutter.
5. **Scrollbars inside modals are hidden globally** by `globals.css` for
   `[data-slot=dialog-content]`, `[data-slot=sheet-content]`, `[role=dialog]`,
   `[role=alertdialog]`, and `.fixed.inset-0.items-center`. Scrolling still works. Fullscreen
   editors use `fixed inset-0 flex flex-col` (no `items-center`) and loading overlays use
   `absolute`, so neither is caught.
6. **Plain-portal modals own their exit animation.** The parent unmounts them, so route every
   close through a `requestClose()` that plays `animate-*-out`, then unmounts after
   `EXIT_MS = 170` (must stay ≥ the longest `-out` keyframe).

**Standard anatomy** (all three families converge on it):

```
┌─────────────────────────────────────────────┐
│ HEADER  gradient wash + icon tile + title   │  border-b border-slate-100
│         bg-gradient-to-br from-indigo-50/70 to-white   px-5 py-4 sm:px-6 sm:py-5
├─────────────────────────────────────────────┤
│ BODY    min-h-0 flex-1 overflow-y-auto      │  p-5 sm:p-6, space-y-4
├─────────────────────────────────────────────┤
│ FOOTER  bg-slate-50 · Cancel (ghost) right  │  border-t border-slate-100, px-5 py-4
│         + Confirm (tinted solid) rightmost  │
└─────────────────────────────────────────────┘
```

Panel `rounded-2xl bg-white shadow-2xl` (`rounded-3xl` for meetings modals). Widths
`max-w-md` (confirm) · `max-w-lg` (form) · `max-w-2xl` · `max-w-3xl` · `max-w-4xl` (two-pane).
Always `max-w-[95vw]` on mobile.

> ⚠ **`DialogFooter` defaults are broken.** It ships `-mx-4 -mb-4 … p-4` while `DialogContent`
> uses `p-6` — the 8px mismatch leaves a visible gutter and the `bg-muted/50` band paints in
> the wrong box. Every real usage overrides it. Prefer writing the footer div yourself.

**`ConfirmActionDialog` — use this for every confirm.**
[confirm-action-dialog.tsx](src/components/common/confirm-action-dialog.tsx).
**Never `window.confirm` / `alert` / `prompt`.** One component covers every case: 4 severities
(`danger warning success info`) each with a matching gradient tile, badge, panel and button
colour; optional warning callout; a "What happens" bullet list; optional required *reason*
textarea; optional **type-to-confirm** guard; internal pending state; async `onConfirm` — on
throw it stays open and fires a `richToast`.

### 8.10 Tabs

Three tab looks. None is the `Tabs` primitive (barely used).

```tsx
// A. Segmented pill rail — /projects/detail (the richest). STICKY.
<div className="sticky top-0 z-20 bg-slate-50/85 py-3 backdrop-blur-md">   {/* ⚠ see §17.1 */}
  <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/70
                  bg-slate-100/70 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]
                  [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <button className={active
      ? "bg-white text-primary-indigo shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-6px_rgba(79,70,229,0.40)] ring-1 ring-indigo-100"
      : "text-slate-500 hover:bg-white/60 hover:text-navy"}>
      <Icon className="h-4 w-4" /> {label}
      {count > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{count}</span>}
    </button>
  </nav>
</div>

// B. Sliding-highlight rail — /clients/detail. The active pill is a framer-motion
//    layoutId element, so the white highlight SLIDES between tabs instead of popping.
{isActive && (
  <motion.span layoutId="clientTabHighlight"
    className="absolute inset-0 rounded-xl bg-white shadow-md shadow-indigo-500/10 ring-1 ring-inset ring-indigo-200"
    transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.9 }} />
)}

// C. Solid-fill rail — HR subnav: active = "bg-primary-blue text-white shadow-sm" (legacy).
```

**Tab-pane entrance — two mechanisms, don't mix them:**
* CSS: `motion-safe:animate-tab-in` **[verified-in-CSS]**. Deliberately **no fill-mode** — both
  keyframes end on the element's natural style, so a dropped (reduced-motion) or interrupted
  run leaves a plainly visible element rather than one pinned at `opacity: 0`. A JS entrance
  instead writes `opacity: 0` into the style attribute and needs a tick to clear it.
* Framer: `<motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
  transition={{duration:0.28, ease:"easeOut"}}>` — keyed on the tab so it replays per switch.

`animate-underline-in` (scaleX-from-left) is **not** a tab-rail animation here; its only use is
the segmented outcome picker in `meetings_new/AdvanceOutcomeModal`.

---

## 9. Motion

Motion is **subtle, short, and interruptible**. Three easing families, by role:

| Role | Curve | Duration |
|---|---|---|
| **Shell / chrome** (rail width, shell margin) | `cubic-bezier(0.32, 0.72, 0, 1)` | **260ms** |
| Page & component entrances | `cubic-bezier(0.22, 1, 0.36, 1)` | 180–280ms |
| Popovers / overlays | `cubic-bezier(0.16, 1, 0.3, 1)` | 140–300ms |
| Exits | `cubic-bezier(0.4, 0, 1, 1)` | 140–170ms |
| Hover recolour | `transition-colors` (default ease) | 150–200ms |
| Glass hover shadow | `transition-shadow` | 300ms |
| Sidebar spotlight fade | `ease-out` | **450ms** |

### 9.1 Tailwind keyframes ([tailwind.config.ts](tailwind.config.ts))

| Animation | Duration / easing | Use | Status |
|---|---|---|---|
| `tab-in` | 240ms `(0.22,1,0.36,1)` | tab pane entrance | **[verified-in-CSS]** |
| `underline-in` | 280ms | active-segment underline, scaleX from left | **[verified-in-CSS]** |
| `backdrop-in` / `-out` | 180 / 160ms | modal backdrop | **[config-declared]** |
| `panel-in` / `-out` | 240 / 160ms | modal panel (`translateY + scale`) | **[config-declared]** |
| `row-in` / `-out` | 180 / 140ms | expanding table detail row | **[config-declared]** |

`-in` animations carry **no fill-mode**; `-out` animations carry `forwards` (the element
unmounts a beat later and would otherwise snap back to visible for those last frames).

> A `<tr>` cannot be height-animated (its box is the table's to give), so `row-in`/`row-out`
> fade + slide instead, and the parent holds the row mounted for the length of the run.

### 9.2 globals.css keyframes

`slideInFromRight` (300ms right panel) · `fadeInOverlay` · `popIn` (140ms popover/dropdown/
select) · `qaShimmer` (travelling gradient text) · `qaRowIn` (staggered menu rows, per-index
inline delay) · `star-movement-top/bottom` (StarBorder) · `routeProgress` (top route bar) ·
`crmSoftReveal` (220ms page reveal) · `heroOrbDrift` (26s / 34s ambient hero orbs) ·
`n2b-card-float` / `n2b-online-pulse` / `n2b-shine-sweep` (login only) · `spin`.

### 9.3 Rules

* **Always pair with `motion-safe:`** or add a `prefers-reduced-motion` guard. Most
  globals.css animations already have one; the Tailwind ones rely on the `motion-safe:` prefix
  at the call site. Chrome transitions use `motion-reduce:transition-none` inside `CURVE`.
* **Transform + opacity only.** No animating `height`, `width`, `top`, or box-shadow — with
  two deliberate exceptions: the rail's `transition-[width,transform,box-shadow]` and the glass
  card's `transition-shadow`. Both are named-property, not `transition-all`.
* **Never `transition-all` on a moving container.** Name the properties.
* `[will-change:…]` for the length of a gesture only (the rail's card and its `Reveal` runs).
  Without it, animated text re-rasterises every frame and shimmers.
* Hover feedback on rows and cards is `transition-colors` — never `transition-all`.
* `hover:scale-[1.03]` is allowed on the **primary CTA only**.
  `active:scale-[0.98]` / `active:translate-y-px` on buttons for tactility.
* Ambient loops (hero orbs) capped at ≤2 per viewport, transform/opacity only, frozen under
  reduced motion.
* `backdrop-filter` is attached **only while an overlay is open** — a permanently-live one
  costs a compositor pass even at `opacity: 0`.
* Framer Motion is for `BlurFade` (staggered section entrances), `NumberTicker` (spring-counted
  KPI values, `damping: 60, stiffness: 100`), the `layoutId` tab highlight, the login page, and
  `AnimatePresence`. Everything else is CSS.

> ⚠ **`tailwindcss-animate` is NOT installed.** `animate-in` (32 files), `zoom-in-95` (15),
> `fade-in-0` (7), `slide-in-from-*`, `data-open:animate-in` — used throughout `dialog.tsx`,
> `select.tsx`, `dropdown-menu.tsx`, `badge.tsx` — **compile to nothing**
> **[verified absent from compiled CSS]**. The dialog/select entrance animations you think you
> are getting are not running. Use the hand-rolled `animate-panel-in` / `animate-pop-in` family,
> or install the plugin.
>
> ⚠ **`AnimatePresence` exit never unmounts** in the `meetings_new` workspace — a known trap
> there; don't rely on exit callbacks in that module.

---

## 10. Charts

All chart imports go through [`shared/charts/index.tsx`](src/shared/charts/index.tsx), which
re-exports recharts plus shared config and lazy-loading wrappers.

```ts
chartAxisTick     = { fill: "#64748b", fontSize: 12 }
chartTooltipStyle = { borderRadius: "8px", border: "1px solid #e2e8f0",
                      boxShadow: "0 12px 26px rgba(15,23,42,0.10)",
                      fontSize: "12px", padding: "10px 12px" }
chartPalette      = ["#2563eb","#059669","#d97706","#7c3aed","#dc2626","#0891b2",
                     "#475569","#db2777","#4f46e5","#0f766e","#9333ea","#ea580c"]
```

Grid lines `stroke="#e2e8f0" strokeDasharray="3 3"`. Pie/donut separators `stroke="#ffffff"`.
Empty state: `EmptyChart` (`Inbox h-8 w-8 text-slate-400` + "No data yet").

Rules:
* Wrap in `LazyChart` / `LazySection`; show `ChartSkeleton` while loading.
* **`isAnimationActive={false}`** — recharts renders blank on mount otherwise.
* Zero-value bars need `minPointSize` or they vanish.
* `ResponsiveContainer` always; never a fixed pixel width.

> `chartPalette` still leads with `#2563eb` (blue-600), off-theme for a UI that banned blue
> accents. Reorder to lead with `#4f46e5` when you can afford to re-colour every chart at once.

---

## 11. Document / print surfaces

`/invoices/detail`, `/invoices/download`, `/invoices/receipt`, `/proposals/detail`,
`/proposals/download`, `/leads/proposal` render **paper**, not app UI. They bypass the shell
(§5.1) and follow [`bill-tokens.ts`](src/components/billing/bill-tokens.ts).

```
Surface   bg-white on #f8fafc · rounded-[24px] card / rounded-[28px] document
Border    #e2e8f0 hairline, every divider
Ink       #1E3A5F heading · #334155 body · #64748b label
Brand     #4338ca strong · #eef2ff soft · #4f46e5 total
Shadow    0 2px 12px rgba(35,38,47,0.05)   (CTA: 0 12px 32px rgba(79,70,229,0.22))
Buttons   rounded-full pills, h-8 (sm) / h-10 (md) — emphasis by COLOUR, not size
Inputs    h-12 rounded-[18px] · mini h-9 rounded-[12px] tabular-nums
Captions  text-[10px] font-semibold uppercase tracking-[1px]
Tones     SJ_TONE: gray/blue/amber/green/coral/gold (soft tint + strong text)
```

Structure (radii, elevation, the pill scale) is ported from the Sejal Jewellers bill page;
**colour is N2B's own** — the literal-blue port was reverted 29 Jul 2026 at the user's request.
Values are raw hex in arbitrary Tailwind values rather than new config entries, deliberately
scoped to these pages. `SJ_BG` is still `#f8fafc` — correct, because these pages set their own
paper canvas and never sit on `--background`.

PDF constraints ([invoice-pdf.ts](src/components/invoices/invoice-pdf.ts)) — **correctness
rules, not preferences**:

* **Fixed `PAPER_W = 768`px, never `max-w-*`** — a narrow window would otherwise produce a
  differently-laid-out PDF than a wide one.
* `PAPER_H = round(768 × 297/210)` — A4 ratio, so every sheet is a real page.
* **Never `truncate` inside the paper.** html2canvas re-measures with its own metrics; an
  overflow-hidden box that just fits on screen comes out chopped. Use `break-words`.
* Mark unbreakable blocks with `{...NO_BREAK}` and sheets with `{...SHEET}`.
* Nothing here uses `font-mono` — one typeface everywhere.
* Capture in a **visible** tab; a background tab measures 0-wide.
* The v8 renderer paints text through an **SVG `foreignObject`**, not html2canvas rasterisation
  — html2canvas painted text at ~6.5px and it read low-quality. View opens a **new tab**.

---

## 12. States

| State | Pattern |
|---|---|
| **Loading (skeleton)** | `<Skeleton className="h-6 w-24" />` → `animate-pulse rounded-md bg-slate-100`. Shared: `TableSkeleton`, `ChartSkeleton`, `KPISkeleton`, `DashboardKpiSkeleton`, plus **`ShellBootSkeleton`** which mirrors the floating-chrome geometry exactly so the boot state doesn't jump. |
| **Loading (spinner)** | `<Loader2 className="h-4 w-4 animate-spin" />`. |
| **Loading (route)** | `RouteTransitionIndicator` → `.route-progress-bar` sweeping bar (flattened to a static full-width bar under reduced motion). |
| **Empty** | dashed box: `flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center`, `Icon h-8 w-8 text-slate-300`, `text-sm font-semibold text-slate-500`. Also the `Empty*` primitive family. |
| **Inline error** | `FormBanner` (`border-rose-200 bg-rose-50 text-rose-700`, `role="alert"`) / `FieldError` + `aria-invalid`. |
| **Toast** | `richToast(msg, ok)` — imperative DOM: `rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`, **`border-l-4`** emerald/rose rail, `h-9 w-9 rounded-xl` tinted icon tile, `sm:min-w-[300px] sm:max-w-md`, slide-up, auto-close, click to dismiss. **50 files.** `react-hot-toast` is also present in **23** files — two systems; prefer `richToast`. |
| **RBAC denied** | `NoAccessPlaceholder` in the content area (chrome stays), `LockedCard` for a gated card, `<Gate>` / `useGate` for inline gating. Convention: **create → hide, edit → disable**. |

---

## 13. z-index contract

| Layer | z |
|---|---|
| In-card decorations, sticky table headers | `z-10` |
| Sticky tab rails | `z-20` |
| Mobile sidebar backdrop · `ShellBootSkeleton` rail | `z-40` |
| **Sidebar rail** | **`z-50`** |
| **Modals / dialogs / their backdrops** | **`z-50`** |
| Stacked modal (dialog over dialog) | `z-[60]` |
| Toasts | `z-[9999]` |
| Select / dropdown popups | `z-[99999]` |
| Global CSS override for base-ui dialogs | `10000 !important` |

> The single most common z-index bug here: **a modal at `z-40` leaves the sidebar bright and
> clickable.** `z-50` minimum, and portal to `<body>` so DOM order wins the tie.
>
> Note `AppHeader` has **no z-index at all** — it is a flex sibling above `<main>` in DOM order,
> which is sufficient. Do not add one; a `z-50` header would tie with the rail.

---

## 14. Accessibility

Done consistently — keep it up:

* `aria-label` on every icon-only button; `aria-hidden` on decorative icons, orbs, spotlights,
  edge-lights and separators.
* `role="dialog" aria-modal="true" aria-label={…}` + `tabIndex={-1}` on plain-portal modals,
  with a real **focus trap** and focus restoration to the opener (`opener?.isConnected` guard).
* `aria-current="page"` on the active nav row; `aria-current` on the active tab.
* `aria-pressed` on the sidebar pin toggle; `aria-label` flips between
  "Keep menu open" / "Collapse menu".
* `aria-invalid` paired with `FieldError`; `role="alert"` on `FormBanner`.
* `aria-label="Breadcrumb"` on the trail `<nav>`.
* Collapsed-rail affordances: `title={item.name}` when collapsed, and the search input gets
  `tabIndex={-1} aria-hidden` so a collapsed rail has no invisible tab stops.
* `pointer-events-none` on every decorative layer so it can't eat clicks.
* Escape closes every overlay and the mobile drawer; `body.overflow` restored on unmount.
* `prefers-reduced-motion` respected across globals.css and via `motion-reduce:` in `CURVE`.

Gaps worth closing: `focus-visible:ring-3` is dead so the ui-kit primitives have **no visible
focus ring** (§15.2) — the shell's own `focus-visible:ring-2 focus-visible:ring-slate-900/10`
is the pattern to copy. And `text-slate-300`/`text-slate-400` on white is below 4.5:1 — fine
for decorative eyebrows, not for anything a user must read.

---

## 15. Verified gotchas

Each confirmed against source or compiled CSS — not speculation.

| # | Gotcha | Impact |
|---|---|---|
| 1 | **`tailwindcss-animate` is not installed.** `animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*` compile to nothing. | Dialog/Select/Dropdown/Badge entrance animations silently don't run. 32 files affected. |
| 2 | **`ring-3` is not a Tailwind 3 class** (`ring-0/1/2/4/8` only). Used in `button.tsx`, `input.tsx`. | The ui-kit focus ring never paints. |
| 3 | **`rounded-4xl` is not a Tailwind 3 class.** Used in `badge.tsx`. | Base `Badge` has square corners. |
| 4 | **`font-heading` is not defined** in `fontFamily`. Used in 5 files (`CardTitle`, `DialogTitle`). | Silently inherits — harmless, but misleading. |
| 5 | **Geist Mono is loaded but never wired to `font-mono`.** | `font-mono` gets the system stack; the woff ships for nothing. |
| 6 | **Tailwind JIT can't see interpolated classes.** `` `bg-${color}-500` `` never compiles. | Always full static strings in a `Record<K, string>`. Every accent map here does this (`ICON_TONE`, `SPOTLIGHT_STYLES`, `SJ_TONE`, `TONE`). |
| 7 | **`ring-<cssvar>/NN` is invalid** and silently falls back to blue. | Use a literal colour, or `/opacity` on a real palette class. |
| 8 | **Tailwind-v4-only variants no-compile here**: `*:data-[slot=…]`, `in-data-[…]`, `has-data-[…]`. Present in `button.tsx`, `card.tsx`, `select.tsx`, `badge.tsx`. | Use `data-[x]:` and `group-data-[x]/name:` instead. |
| 9 | **`space-y-*` offsets `fixed` overlays by 24px.** | Portal to `<body>`, or `!mt-0`. |
| 10 | **A `z-40` overlay paints under the sidebar.** | `z-50` minimum. |
| 11 | **`sr-only` on a file input leaks overflow to the VIEWPORT** (phantom horizontal scrollbar). | Stretch the input over its label at `opacity-0`. 3 sites still unfixed. |
| 12 | **`overflow-x-hidden` wrapper + `table-auto` clips the Actions column.** | `table-fixed` + explicit column widths. |
| 13 | **`DialogFooter`'s `-mx-4 … p-4` vs `DialogContent`'s `p-6`** leaves an 8px gutter and mis-paints `bg-muted/50`. | Override, or write the footer yourself. |
| 14 | **base-ui `Dialog` gets stuck open** on `/projects/detail` and the calls log; it also swallows clicks in nested Radix popovers. | Use a plain portal overlay there. |
| 15 | **`Button` is not `forwardRef`.** | Style links with `buttonVariants({…})`, not `asChild`. |
| 16 | **Retone the default Button with `from-*`/`to-*`, not `bg-*`.** | `bg-*` loses to the gradient. |
| 17 | **Recharts renders blank on mount** without `isAnimationActive={false}`. | Always set it. |
| 18 | **base-ui `Select` shows the raw id** when `items` can't be derived. | Never filter `SelectItem` children out; pass `items` explicitly if wrapped. |
| 19 | **`min-w-0` on `SelectValue`/`ItemText` is load-bearing.** | Without it, long labels spill past the trigger border. |
| 20 | **`setState`-in-effect is an eslint ERROR** in this repo. | Read storage lazily in the `useState` initializer (as `Sidebar` does); adjust derived state in the render phase. |
| 21 | **A mount-once ref dies under StrictMode.** | Don't gate one-time work on a ref; use the nav-epoch pattern (`useHistoryTab`). |
| 22 | **`grid-rows` `0fr ↔ 1fr` won't animate** (Tasks & Modules collapsible). | Animate `max-height` or transform instead. |
| 23 | **Interpolated Tailwind + `--n2b-chrome`:** `bg-[var(--n2b-chrome)]` is fine, but `bg-[var(--n2b-chrome-${state})]` is not. | Write the three literal classes. |
| 24 | **The shipped CSS bundle is stale (29 Jul).** | Rebuild before verifying anything about the new chrome or the `panel/backdrop/row` keyframes. |

---

## 16. Dead code inventory (newly quantified)

This is the biggest finding of this pass. **`globals.css` is 468 lines; roughly 240 of them
(the ported CRM-V2 "HR design system", lines ~212-454) are now referenced by almost nothing.**

### 16.1 `globals.css` classes with ZERO uses in `src/**`

```
.page-header  .page-header-left  .page-header-icon  .page-title  .page-subtitle  .page-wrapper
.kpi-grid  .kpi-card  .kpi-card-icon  .kpi-card-ghost  .kpi-label  .kpi-value  .kpi-sub
.cs-card-header  .cs-card-title  .cs-card-body  .cs-table-wrapper
.badge-pill  .badge-indigo/-emerald/-rose/-amber/-slate/-violet/-sky
.cs-btn-primary  .cs-btn-success  .cs-btn-outline
.cs-input  .cs-label  .cs-search  .cs-search-icon
.filter-bar  .avatar-circle  .empty-state  .cs-spinner  .hr-scope
.modal-header  .modal-body
.cs-title-gradient  .cs-hero-orb  .cs-hero-orb--slow
.animate-slide-in-right  .animate-fade-in-overlay  .animate-star-movement-*  (via StarBorder only)
```

Notable: **`.cs-title-gradient` and `.cs-hero-orb`** were added *for* the dashboard's
elevated-light hero. The dashboard was since rebuilt on frosted glass with inline Tailwind orbs,
so both — including the careful `@supports (background-clip: text)` feature gate — are now dead.

### 16.2 `globals.css` classes still load-bearing — **keep these**

| Class | Uses | Where |
|---|---|---|
| `.hide-scrollbar` | 23 | list/table views |
| `.cs-card` | 14 | **all in `/expenses/insights`** |
| `.mobile-card` / `.mobile-card-list` | 12 | `/admin/users` + 5 HR pages |
| `.cs-table` | 1 | `/expenses/insights` |
| `.route-progress-bar`, `.crm-soft-reveal`, `.animate-pop-in`, `.animate-qa-row-in` | — | live |
| `[data-slot="dialog-*"]` overrides + the modal scrollbar-hiding block | — | **live and critical** — they match *attributes*, not class names, so a class-usage grep will not find them |
| `.react-flow` / `.role-flow` overrides | — | policies / salary-builder / hierarchy graphs |
| `.animate-card-float`, `.animate-online-pulse`, `.n2b-shine-sweep` | — | `/login` |
| `@keyframes spin`, `@media (prefers-reduced-motion)` blocks | — | live |

### 16.3 Dead files / tokens

| Item | Evidence |
|---|---|
| **`src/app/hr/_components.tsx`** (267 lines: `HRSubnav`, `HRPageHeader`, `HRStatCard`, `HRPanel`, `HRBadge`, `TableSkeleton`, `EmptyState`, `InitialAvatar`, `LoadingLine`, tone helpers, formatters) | **0 files import `hr/_components`.** The HR pages now hand-roll the standard `from-white via-indigo-50/80 to-violet-50` hero instead |
| `--sidebar-*` token block (8 vars) + the `sidebar.*` Tailwind colour map | nothing uses `bg-sidebar` / `text-sidebar-foreground` |
| `--premium-*` (7 vars), `--glow-indigo/violet/ring`, `--shadow-hero`, `--radius-sm…pill` | no JSX reads them |
| `info: #0EA5E9` / `text-info` | 0 uses |
| `bg-navy` | 3 uses — effectively dead; `text-navy` (555) is the live one |

> **Recommended cleanup order** (each is independently safe): delete `hr/_components.tsx` →
> delete `.cs-title-gradient` / `.cs-hero-orb` → delete the `--sidebar-*` block and its
> Tailwind map → delete the zero-use HR classes, keeping `.cs-card` / `.cs-table` /
> `.mobile-card*` / `.hide-scrollbar` and **all** `[data-slot]` rules → migrate
> `/expenses/insights` off `.cs-card` last, then drop the rest.
> **Do not touch the `[data-slot="dialog-*"]` block or the modal scrollbar rules.**

---

## 17. Known inconsistencies (technical debt, not style)

1. **~91 scrims still assume the old canvas.** `bg-slate-50/{70,80,85,90,95}` and 10
   `min-h-screen bg-slate-50` wrappers were tuned against `#f8fafc`; the canvas is now
   `#f4f4f5`. Most visible on the 7 sticky `backdrop-blur` rails, especially
   `/projects/detail`'s `bg-slate-50/85`, which now paints a cooler film over a hueless canvas.
   *Fix:* use `bg-background/85` for a canvas scrim; keep `bg-slate-50/70` only for an
   intentional slate well *inside* a white card.
2. **Four neutral/semantic duplicate hues.** `gray` 1082 vs `slate` 5795 · `blue` 218 vs
   `indigo` 3000 · `red` 164 vs `rose` 1147 · `green` 57 vs `emerald` 1233. Confined to
   `/hr/**`, `/analytics` and older modals. Migrate opportunistically; never mix a pair inside
   one component.
3. **Two brand blues.** `primary-blue #3B82F6` (31 uses, HR subnav active state) contradicts
   the "never blue accent" rule. `primary-indigo` is correct.
4. **Two primary gradients.** `indigo→purple-600` vs `indigo→violet-600` (§3.5).
5. **Two toast systems.** `richToast` (50 files) vs `react-hot-toast` (23).
6. **Hover-lift violations of the explicit no-lift rule.** `SpotlightStatCard`'s default variant
   (`hover:-translate-y-0.5`), `SJ_BTN_PRIMARY`/`SJ_BTN_CTA` (`hover:-translate-y-0.5`), and
   `globals.css`'s dead `.kpi-card:hover { translateY(-4px) }` / `.cs-btn-primary:hover
   { translateY(-1px) }`. The dashboard glass layer got this right — copy it.
7. **Three page-header families for one job.** `PageHero` (10) · `ExpensesHeader` (6, a
   near-verbatim copy) · the hand-rolled hero on `/hr` and `/my-work`, plus the dead
   `.page-header` global and the dead `HRPageHeader`. **Consolidate on `PageHero`.**
8. **Three stat-card families.** `SpotlightStatCard` (8) · dashboard `KPICard`+glass (1 page) ·
   dead `HRStatCard` / `.kpi-card`.
9. **Two page-top languages now.** `PageHero` (opaque, `rounded-3xl`, navy `font-black` H1) vs
   the dashboard's glass hero (`rounded-[26px]`, slate `font-extrabold` fluid H1, frosted
   chips). Both are deliberate today; decide which wins before a third appears.
10. **The `ui/` primitives are a shadcn/base-ui port that page code largely bypasses.** `Table`,
    `Tabs`, `Badge`, `Progress` are barely used; pages hand-roll. That is why the dead classes
    in §15 went unnoticed for so long. Treat `ui/` as *primitives for dialogs and forms*, not
    as the page-level design system.
11. **11 files import `lucide-react` directly** instead of the `@/shared/icons` barrel (mostly
    `features/chat/**` + `app/chat/page.tsx`). The barrel exists so icon choices stay
    reviewable and tree-shaking stays predictable.
12. **`GUTTER` is duplicated as a literal** in `AppHeader` (`sm:px-[18px]`) and
    `ShellBootSkeleton` (`inset-y-[18px] left-[18px]`, `w-[68px]`, `h-[54px]`). Three files,
    one number, no enforcement.

---

## 18. Checklist for new UI

**Do**
- [ ] Start from an existing page in the same module and copy its shell.
- [ ] `slate` for neutrals, `indigo` for brand, semantic tones from §3.6.
- [ ] `text-navy` for headings, `text-slate-400` for eyebrows/labels.
- [ ] `tabular-nums` on every number.
- [ ] `rounded-xl`/`rounded-2xl` cards, `border-slate-200/70`, `shadow-sm`.
- [ ] `rounded-[26px]` + the chrome shadow **only** if the surface belongs to the floating-chrome family.
- [ ] `PageHero` + `SpotlightStatCard` for a new top-level page.
- [ ] `bg-[var(--n2b-chrome*)]` for chrome surfaces — never the raw hex.
- [ ] `ConfirmActionDialog` for every confirmation; `richToast(msg, ok)` for every result.
- [ ] Portal modals to `<body>` at `z-50` with `bg-black/55`, no blur.
- [ ] Lock scroll on **`<main>`** as well as `<body>`, and pad back the gutter.
- [ ] Full static class strings in a `Record<Key, string>` for any dynamic accent.
- [ ] `motion-safe:` on every animation; name the transitioned properties.
- [ ] `transition-colors` (or `transition-shadow`, neutral only) for hover.
- [ ] `hidden sm:table-cell` to drop table columns instead of scrolling.
- [ ] `aria-label` on icon-only buttons, `aria-hidden` on decoration.
- [ ] Read one-time browser state in the `useState` initializer, not an effect.

**Don't**
- [ ] `window.confirm` / `alert` / `prompt`.
- [ ] Native `<select>`, `<input type="date">`, or unstyled `<button>` — use the kit.
- [ ] `text-primary` / `bg-primary` when you mean indigo (it is near-black).
- [ ] `gray-*`, `blue-*`, `red-*`, `green-*` in new code.
- [ ] Purple buttons or purple borders (the indigo→purple *gradient* CTA is the exception).
- [ ] Hover lift, hover scale, or a coloured glow on cards and rows.
- [ ] Coloured left-border accent stripes on rows.
- [ ] "Next step" suggestion badges — tick + number only.
- [ ] `transition-all` on anything that moves.
- [ ] Interpolated Tailwind class names.
- [ ] New rules in `globals.css`.
- [ ] `animate-in` / `fade-in-0` / `zoom-in-95` / `ring-3` / `rounded-4xl` / `font-heading` (all dead).
- [ ] An indigo/violet bloom in a card's shadow.
- [ ] A `z-index` on `AppHeader`.

---

## 19. Copy-paste recipes

```tsx
// ── Standard page shell ───────────────────────────────────────────────────
<div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
  <PageHero badge="MODULE" badgeIcon={<Icon className="h-3 w-3" />}
            title="Page Title" subtitle="One line of context."
            actions={<button className={HERO_PRIMARY_BTN}>New</button>} />

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <SpotlightStatCard title="Total" value="₹1,20,000" color="indigo"
                       icon={<Wallet className="h-5 w-5" />} />
  </div>

  {/* filter toolbar */}
  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70
                  bg-white p-4 shadow-sm">
    <SearchInput value={q} onChange={setQ} className="w-full sm:w-72" />
  </div>

  {/* table card — see §8.8 */}
</div>

// ── Chrome-aligned page shell (edges line up with the header card) ────────
<div className="mx-auto w-full max-w-[1760px] space-y-6 px-[18px] pb-8 pt-2.5">

// ── Section card ──────────────────────────────────────────────────────────
<section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
    <h2 className="text-base font-bold text-navy">Title</h2>
    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">See all</button>
  </div>
  <div className="p-5">{children}</div>
</section>

// ── Floating-chrome surface (only for shell-family surfaces) ──────────────
const CHROME_SHADOW =
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.18)]";
<div className={`rounded-[26px] bg-[var(--n2b-chrome)] ${CHROME_SHADOW}`}>

// ── Status pill ───────────────────────────────────────────────────────────
const TONE = {                                   // full static strings — JIT-safe
  paid:    "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  overdue: "bg-rose-50 text-rose-700",
  draft:   "bg-slate-100 text-slate-600",
} as const;
<span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                    TONE[status])}>{label}</span>

// ── Icon tile (page cards: gradient) ──────────────────────────────────────
<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
  <Icon className="h-5 w-5" />
</div>

// ── Icon chip (glass/chrome: frosted, colour on the GLYPH) ────────────────
const ICON_TONE = { indigo: "text-indigo-500", emerald: "text-emerald-500" } as const;
<div className={`flex h-11 w-11 items-center justify-center rounded-full
                 bg-slate-100/70 ring-1 ring-inset ring-white/80 ${ICON_TONE[accent]}`}>
  <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
</div>

// ── Circular chrome action button ─────────────────────────────────────────
<button className="flex h-10 w-10 items-center justify-center rounded-full border
                   border-slate-200 bg-white text-slate-500 transition-all
                   hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600">

// ── Identity avatar + presence dot ────────────────────────────────────────
<div className="relative shrink-0">
  <div className="flex h-8 w-8 items-center justify-center rounded-full
                  bg-gradient-to-br from-indigo-500 to-indigo-700
                  text-[13px] font-bold text-white">{initials}</div>
  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full
                   border-2 border-white bg-emerald-400" />
</div>

// ── Empty state ───────────────────────────────────────────────────────────
<div className="flex min-h-40 flex-col items-center justify-center rounded-xl
                border border-dashed border-slate-200 text-center">
  <Inbox className="h-8 w-8 text-slate-300" />
  <p className="mt-3 text-sm font-semibold text-slate-500">Nothing here yet</p>
</div>

// ── Cursor-tracked glow WITHOUT re-rendering ──────────────────────────────
const onMove = (e: React.MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
};
// then, on a pointer-events-none child:
style={{ background:
  `radial-gradient(220px circle at var(--spot-x,50%) var(--spot-y,50%), rgba(99,102,241,0.16), transparent 72%)` }}
```

---

## 20. File map

```
src/
├─ app/
│  ├─ globals.css              ★ tokens + keyframes (live) + legacy HR system (~85% DEAD, §16)
│  ├─ layout.tsx               ★ DM Sans / Geist Mono wiring
│  ├─ login/                    distinct language — dark #0c0e1a artwork panel + white glass form
│  ├─ dashboard/
│  │  ├─ SpotlightCard.tsx     ★ DASH_* glass surface tokens (§8.4)
│  │  └─ page.tsx               glass hero + 6 KPI cards + ICON_TONE
│  ├─ expenses/_components/     ExpensesHeader (PageHero copy), ModalPortal (modal family C)
│  ├─ expenses/insights/        the ONLY page still on .cs-card / .cs-table
│  ├─ hr/_components.tsx        ⚠ DEAD — zero importers (§16.3)
│  ├─ meetings_new/ModalShell   modal family B
│  └─ projects/detail/          sticky pill tabs, per-tab components
├─ components/
│  ├─ ui/                      33 base-ui/radix primitives (dialogs + forms; see §17.10)
│  ├─ page/page-primitives.tsx ★ PageHero, SpotlightStatCard, HERO_*_BTN
│  ├─ billing/bill-tokens.ts   ★ document/print token set (SJ_*)
│  ├─ common/confirm-action-dialog.tsx ★ the one confirm modal
│  ├─ layout/
│  │  ├─ Sidebar.tsx           ★ floating rail — geometry constants, CURVE, spotlight (§8.1)
│  │  ├─ AppHeader.tsx         ★ floating bar + URL-derived breadcrumb (§8.2)
│  │  ├─ AuthWrapper.tsx       ★ shell frame, --n2b-sb margin, ShellBootSkeleton
│  │  ├─ sidebar-events.ts      window-event bridge for the mobile drawer
│  │  ├─ BrandMark.tsx / HeaderCheckInOut.tsx / RouteTransitionIndicator.tsx
│  ├─ projects/project-overlay-kit.tsx ★ plain-portal overlay + scroll lock + focus trap + EXIT_MS
│  ├─ skeletons/               Table / Chart / KPI skeletons
│  └─ rbac/                    Gate, LockedCard, NoAccessPlaceholder
├─ features/chat/              ⚠ 6 files import lucide-react directly (§17.11)
├─ shared/
│  ├─ icons/index.ts           ★ single lucide barrel — import from here
│  └─ charts/index.tsx         ★ recharts barrel + palette + axis/tooltip config
└─ lib/
   ├─ utils.ts                 cn(), formatCurrency, formatDate, getInitials
   ├─ rich-toast.ts            ★ richToast()
   ├─ rbac.ts                  route→permission map (drives nav + route gating)
   ├─ fiscal-year.tsx          global FY scope read by the header switcher
   └─ company-brand.ts         logo/name for the rail's brand glyph
```

### Route census (63 pages)

```
/  /login
/dashboard  /my-work  /my-leaves  /calendar  /notifications  /notices  /chat  /profile  /company
/analytics  /analytics/detailed  /team-meetings  /holidays
/leads  /leads/detail  /leads/complete-meeting  /leads/proposal  /lead-sources  /leads-analytics
/clients  /clients/detail  /followups  /meetings_new
/products-services  /proposals/detail  /proposals/download  /proposals/terms
/projects  /projects/detail  /projects/detail/service  /projects/pipeline  /tasks  /tasks/detail
/invoices  /invoices/detail  /invoices/download  /invoices/receipt  /bank-accounts  /reports/approvals
/expenses  /expenses/monthly  /expenses/categories  /expenses/reminders  /expenses/insights
/hr  /hr/employee  /hr/departments  /hr/attendance  /hr/leaves  /hr/payroll  /hr/shifts
/hr/policies  /hr/salary-builder  /employees  /employees/create  /employees/detail
/workload  /workload/detail
/admin/users  /admin/roles  /admin/hierarchy
```

Chrome-free routes: `/login` (pre-mount render) · `/invoices/receipt` · `/invoices/download` ·
`/leads/proposal` · `/proposals/download`.
