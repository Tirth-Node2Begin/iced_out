"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { HERO_TITLE } from "./data";
import { DUR, EASE } from "./motion";

/**
 * BrandMorph — the site root has one wordmark, not two.
 *
 * The bar's own "ICED_OUT" is not drawn here. Instead the hero's "Iced Out"
 * *is* the wordmark: it opens at hero size low on the page, then rides up and
 * shrinks into the bar's brand slot as the hero scrolls away, and stays there.
 * The bar is sticky (`.nh-nav-scope`), so the landing spot is a fixed point in
 * the viewport and the type can settle on it for the rest of the page.
 *
 * It travels a letter at a time, left to right. Every glyph is its own flying
 * element with its own start, its own landing and its own moment of departure,
 * so the wordmark reads as a run of type peeling off the headline rather than a
 * block being dragged up the page. See STAGGER for how they are timed.
 *
 * Three decisions carry the whole thing:
 *
 * 1. The travelling type is laid out at the size it is *drawn* at — font-size
 *    is interpolated, not `scale`. A transform scale rasterizes once and
 *    stretches the result, which at the ~11x range between the two ends is the
 *    difference between crisp type and a blurred bitmap. Each flyer is a single
 *    out-of-flow glyph, so the per-frame text layout is not measurable.
 *
 * 2. Both ends are *measured*, never hard-coded — per letter, so the letterfit
 *    the glyphs land in is the bar's own. The hero keeps its real title in flow
 *    (uninked) and the bar keeps its real wordmark in flow (invisible); the
 *    flight reads its start, its landing and the type metrics off those. Change
 *    the type scale in CSS and the flight follows.
 *
 * 3. Nothing about the trip is timed in seconds. Every position is a function
 *    of scroll, so the wordmark is wherever the page is — including on the way
 *    back up.
 *
 * Reduced motion opts out entirely — both slots draw themselves, nothing flies.
 */

/**
 * How much of the trip separates the first letter's departure from the last's.
 *
 * A letter holds station in the hero while the ones to its left go on ahead,
 * then flies over what is left of the gap. They all finish at the same scroll
 * position, so the wordmark assembles in the bar rather than trickling in.
 */
const STAGGER = 0.35;

/**
 * The load entrance, which is a separate thing from the flight above: on first
 * paint the headline writes itself on, one glyph at a time from the left, each
 * riding up from behind its own baseline.
 *
 * `ENTRANCE.step` is the gap between consecutive glyphs. It is deliberately a
 * good deal shorter than the rise itself (DUR.strip) so the letters overlap —
 * the word reads as a single sweep across the headline rather than seven
 * separate arrivals — while still leaving the last glyph landing under the
 * strip panels, which start opening at 0.16s on their own stagger.
 */
const ENTRANCE = { lead: 0.08, step: 0.055 } as const;

/**
 * How far the page has to move before the bar gives its wordmark up.
 *
 * Until the letters actually leave the headline the bar's slot is nobody's, and
 * an empty brand lockup on first paint reads as a missing logo rather than as a
 * hand-over about to happen. So the bar draws its own wordmark at rest and
 * stands down as the flight lifts — far enough up the page that a nudge of the
 * wheel does not flicker it, and long before the first glyph is near the bar.
 */
const LIFTOFF = 24;

type BrandMorphContextValue = {
  /** True only where the provider is mounted, i.e. the site root. */
  active: boolean;
  /** True only while the letters are between the hero and the bar — the one
   *  stretch of the page where the bar is not drawing the wordmark itself. */
  aloft: boolean;
  /** The wordmark, one entry per word. The bar renders a slot per letter. */
  words: readonly string[];
  registerHero: (el: HTMLElement | null) => void;
  registerNav: (el: HTMLElement | null) => void;
};

const noop = () => {};

const BrandMorphContext = createContext<BrandMorphContextValue>({
  active: false,
  aloft: false,
  words: [],
  registerHero: noop,
  registerNav: noop,
});

/**
 * Read by the two slots that hand their geometry over — the hero title and the
 * bar's wordmark. Everywhere else in the app the default applies and both draw
 * themselves as normal.
 */
export function useBrandMorph() {
  return useContext(BrandMorphContext);
}

export function BrandMorph({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [heroSlot, registerHero] = useState<HTMLElement | null>(null);
  const [navSlot, registerNav] = useState<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  /* One listener for the whole flight rather than one per glyph. */
  const { scrollY } = useScroll();

  const active = !reduce;

  /**
   * Who is drawing the wordmark at this scroll position.
   *
   * `rest` and `landed` both mean the bar draws its own copy: at the bottom of
   * the trip the letters are still down on the hero, and at the top they are
   * home — and home *is* the bar's span, which is what the flight measured its
   * landing off in the first place, so the two are the same pixels.
   *
   * Handing it back at the end is not tidiness. The bar is a sticky layer of
   * its own, and it fades a frosted plate in the moment anything scrolls; a
   * glyph that lands and stays a flying element sits under that plate and the
   * wordmark is covered for the whole rest of the page. Landed type belongs to
   * the bar, inside the bar's own stacking context, where the plate is behind
   * it. Only the stretch in between belongs to the flight.
   */
  const [phase, setPhase] = useState<"rest" | "flight" | "landed">("rest");

  /* Every letter finishes at the same scroll position — see STAGGER — so the
     first one's climb is the length of the whole flight. */
  const travel = geometry?.letters[0]
    ? geometry.letters[0].from.top - geometry.letters[0].to.top
    : 0;

  useEffect(() => {
    const sync = (scroll: number) => {
      /* Nothing measured means nothing can fly, so the bar keeps the wordmark
         rather than handing it to a flight that cannot draw it. */
      if (!active || travel <= 0 || scroll <= LIFTOFF) return setPhase("rest");
      setPhase(scroll >= travel ? "landed" : "flight");
    };

    // Synced on mount too — a route restored mid-page is already landed.
    sync(scrollY.get());
    return scrollY.on("change", sync);
  }, [active, travel, scrollY]);

  const value = useMemo(
    () => ({
      active,
      aloft: phase === "flight",
      words: HERO_TITLE,
      registerHero,
      registerNav,
    }),
    [active, phase],
  );

  useEffect(() => {
    if (!active || !heroSlot || !navSlot) return;

    let live = true;
    const measure = () => {
      if (live) setGeometry(read(heroSlot, navSlot));
    };

    measure();
    // The face swaps in under `display: swap`, and every number here is a font
    // metric — re-read once the real one has landed.
    document.fonts?.ready.then(measure).catch(noop);
    window.addEventListener("resize", measure);

    return () => {
      live = false;
      window.removeEventListener("resize", measure);
    };
  }, [active, heroSlot, navSlot]);

  return (
    <BrandMorphContext.Provider value={value}>
      {children}
      {/* `active` is re-checked here rather than cleared out of state: if the
          visitor turns reduced motion on mid-session the flight stops, and the
          two slots go back to drawing themselves. */}
      {active &&
        geometry?.letters.map((letter, i) => (
          <FlyingLetter
            delay={ENTRANCE.lead + i * ENTRANCE.step}
            geometry={letter}
            hold={(i / Math.max(geometry.letters.length - 1, 1)) * STAGGER}
            key={letter.id}
            landed={phase === "landed"}
            scrollY={scrollY}
          />
        ))}
    </BrandMorphContext.Provider>
  );
}

/* ---------------------------------------------------------------- the flight */

function FlyingLetter({
  delay,
  geometry,
  hold,
  landed,
  scrollY,
}: {
  /** When this glyph takes its turn in the load entrance — see ENTRANCE. */
  delay: number;
  geometry: LetterGeometry;
  /** Share of the trip this letter spends waiting its turn, 0 for the first. */
  hold: number;
  /** The bar has the wordmark back — step aside rather than draw it twice. */
  landed: boolean;
  scrollY: MotionValue<number>;
}) {
  const [revealed, setRevealed] = useState(false);

  /* The transforms below read the geometry through a ref, so a re-measure
     (resize, font swap) retunes the flight in place. Closing over it as a value
     would mean rebuilding them, which would replay the entrance rise mid-page.
     `revision` is what tells the chain to recompute against the new numbers
     rather than waiting for the next scroll event. */
  const current = useRef(geometry);
  const revision = useMotionValue(0);

  useEffect(() => {
    current.current = geometry;
    revision.set(revision.get() + 1);
  }, [geometry, revision]);

  /**
   * This letter's own 0→1: 0 while it is still sitting in the headline, 1 once
   * it has settled in the bar.
   *
   * It waits out `hold`, then flies over exactly what is left of the vertical
   * gap. Spending the remaining scroll on the remaining distance is what makes
   * the arrival physical — the glyph climbs with the page, then decelerates onto
   * its landing spot and stops there with no velocity left to absorb.
   */
  const progress = useTransform([scrollY, revision], ([scroll]: number[]) => {
    const { from, to } = current.current;
    const gap = from.top - to.top;
    const held = gap * hold;
    return clamp01((scroll - held) / Math.max(gap - held, 1));
  });

  const x = useTransform(progress, (t) => {
    const { from, to } = current.current;
    return lerp(from.left, to.left, t);
  });

  /* `from.top` is a document position — the hero scrolls — while `to.top` is a
     viewport one, because the bar is sticky. Blending the two is what hands the
     glyph over from moving with the page to being pinned to it, and at t=0 it
     leaves it sitting exactly on the headline it was lifted out of. */
  const y = useTransform([progress, scrollY], ([t, scroll]: number[]) => {
    const { from, to } = current.current;
    return (1 - t) * (from.top - scroll) + t * to.top;
  });

  const fontSize = useTransform(progress, (t) => {
    const { from, to } = current.current;
    return `${lerp(from.fontSize, to.fontSize, t)}px`;
  });

  const lineHeight = useTransform(progress, (t) => {
    const { from, to } = current.current;
    return lerp(from.lineHeight, to.lineHeight, t);
  });

  const letterSpacing = useTransform(progress, (t) => {
    const { from, to } = current.current;
    return `${lerp(from.letterSpacing, to.letterSpacing, t)}em`;
  });

  const fontStretch = useTransform(progress, (t) => {
    const { from, to } = current.current;
    return `${lerp(from.fontStretch, to.fontStretch, t)}%`;
  });

  return (
    <motion.div
      aria-hidden
      className="hv2-brandmorph"
      /* Hidden, not unmounted: the glyph keeps its place in the flight so
         scrolling back up picks it up where it was, rather than replaying the
         load entrance from behind its baseline halfway down the page. */
      data-landed={landed || undefined}
      style={{ x, y, fontSize, lineHeight, letterSpacing, fontStretch }}
    >
      {/* The load entrance — the glyph rides up from behind its own baseline on
          its own beat, so the headline writes itself on from the left instead of
          landing as a slab. The clip is dropped once it has, so nothing crops an
          ascender at the small end of the trip. */}
      <span className="hv2-brandmorph__mask" data-revealed={revealed || undefined}>
        <motion.span
          animate={{ y: "0%" }}
          className="inline-block"
          initial={{ y: "108%" }}
          onAnimationComplete={() => setRevealed(true)}
          transition={{ duration: DUR.strip, delay, ease: EASE }}
        >
          {geometry.text}
        </motion.span>
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------- measurement */

type Slot = {
  /** Hero: document space, it scrolls. Bar: viewport space, it is sticky. */
  top: number;
  left: number;
  fontSize: number;
  /** Unitless / em, so both survive the font-size interpolation. */
  lineHeight: number;
  letterSpacing: number;
  fontStretch: number;
};

type LetterGeometry = {
  id: string;
  text: string;
  from: Slot;
  to: Slot;
};

type Geometry = { letters: LetterGeometry[] };

function read(hero: HTMLElement, nav: HTMLElement): Geometry | null {
  const scope = nav.closest<HTMLElement>(".nh-nav-scope");
  if (!scope) return null;

  const heroLetters = hero.querySelectorAll<HTMLElement>("[data-morph-letter]");
  const navLetters = nav.querySelectorAll<HTMLElement>("[data-morph-letter]");
  if (!heroLetters.length || heroLetters.length !== navLetters.length) return null;

  const scopeBox = scope.getBoundingClientRect();
  const navBox = nav.getBoundingClientRect();

  /* The bar animates itself in on load, so a rect taken off the wordmark would
     bake that entrance offset into the landing spot. Walking offsetParent up to
     the scope — which is sticky, and carries no transform of its own — reports
     where the slot comes to rest instead of where it happens to be.

     That walk reads integer offsets, so each glyph is then placed by its rect
     *relative to* the slot: the shared ancestor transform cancels out of a
     difference, and the letterfit of the landed wordmark stays subpixel-exact. */
  const anchor = offsetWithin(nav, scope);

  const letters = Array.from(heroLetters, (heroLetter, i) => {
    const navLetter = navLetters[i];
    const heroBox = heroLetter.getBoundingClientRect();
    const navLetterBox = navLetter.getBoundingClientRect();

    return {
      id: `${i}-${heroLetter.textContent ?? ""}`,
      text: heroLetter.textContent ?? "",
      from: {
        top: heroBox.top + window.scrollY,
        left: heroBox.left + window.scrollX,
        ...metrics(heroLetter),
      },
      to: {
        top: scopeBox.top + anchor.y + (navLetterBox.top - navBox.top),
        left: scopeBox.left + anchor.x + (navLetterBox.left - navBox.left),
        ...metrics(navLetter),
      },
    };
  });

  return { letters };
}

function metrics(el: HTMLElement) {
  const style = getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight);
  const letterSpacing = parseFloat(style.letterSpacing);
  const fontStretch = parseFloat(style.fontStretch);

  return {
    fontSize,
    // `normal` on any of the three parses to NaN; fall back to the initial value.
    lineHeight: Number.isNaN(lineHeight) ? 1.2 : lineHeight / fontSize,
    letterSpacing: Number.isNaN(letterSpacing) ? 0 : letterSpacing / fontSize,
    fontStretch: Number.isNaN(fontStretch) ? 100 : fontStretch,
  };
}

function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;

  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  return { x, y };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
