"use client";

import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The house curve — cubic-bezier(.22, 1, .36, 1), an out-quint feel. It is the
 * same value in the capture and in new_style §4.3, which is why every reveal,
 * image scale and underline on the page shares it.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Colour/background transitions only (new_style §4.3). */
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

/**
 * Duration and viewport ladders from new_style §6.7 / §6.9. Kept as named
 * constants so the page cannot drift off the system one component at a time.
 */
export const DUR = {
  reveal: 0.72,
  maskLine: 0.95,
  imageZoom: 1.15,
  strip: 1.15,
  odometer: 1.05,
  swap: 0.5,
} as const;

export const AMOUNT = { reveal: 0.35, image: 0.2, heading: 0.4 } as const;

/* ---------------------------------------------------------------------------
   Rise — the plain in-view entrance used by anything that isn't scrubbed.
   ------------------------------------------------------------------------ */
export function Rise({
  children,
  delay = 0,
  y = 22,
  className,
  amount = AMOUNT.reveal,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  amount?: number;
  style?: CSSProperties;
}) {
  // new_style §6.10 flags that the CSS reduced-motion block does not reach
  // Motion's inline styles. Every JS-driven move on this page drops to a plain
  // opacity fade instead.
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      style={style}
      transition={{ duration: reduce ? 0.3 : DUR.reveal, delay: reduce ? 0 : delay, ease: EASE }}
      viewport={{ once: true, amount }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   ScrollWords — the signature reading effect.

   Every long statement on the page (the manifesto, the highlights heading, the
   client roster, "What our clients say") arrives already laid out in a dim
   grey and inks in word by word as the block crosses the viewport. It is a
   *scrub*, not a one-shot: scrolling back lightens the words again.

   Colour is animated rather than opacity — the source keeps the glyphs fully
   opaque throughout, which is why the type never looks washed out mid-reveal.
   ------------------------------------------------------------------------ */
function Word({
  children,
  progress,
  start,
  end,
}: {
  children: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const color = useTransform(
    progress,
    [start, end],
    ["var(--hv2-dim)", "var(--hv2-ink)"],
  );

  return (
    <motion.span className="inline-block whitespace-pre" style={{ color }}>
      {children}
    </motion.span>
  );
}

export function ScrollWords({
  text,
  className,
  as: Tag = "p",
  offset = ["start 0.86", "start 0.3"],
  /** How much of the run each word occupies; >1 overlaps neighbours. */
  spread = 1.9,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  offset?: [string, string];
  spread?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    // motion types offsets as a loose tuple of edge descriptors
    offset: offset as never,
  });

  // Split on whitespace, keeping the separators so the original spacing (and
  // any hard breaks) survives. Word ordinals are assigned in one pass up front
  // rather than with a counter mutated during render.
  const tokens = text.split(/(\s+)/);
  let seen = 0;
  const ordinals = tokens.map((token) => (token.trim().length ? seen++ : -1));
  const step = 1 / Math.max(1, seen);

  const MotionTag = motion[Tag];

  // Scrubbed colour is a scroll effect; with reduced motion the statement is
  // simply set in full ink from the start.
  if (reduce) {
    const Tail = Tag;
    return (
      <div ref={ref}>
        <Tail className={className} style={{ color: "var(--hv2-ink)" }}>
          {text.split("\n").map((line, i, all) => (
            <span key={`l-${i}`}>
              {line}
              {i < all.length - 1 ? <br /> : null}
            </span>
          ))}
        </Tail>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <MotionTag aria-label={text} className={className}>
        {tokens.map((token, i) => {
          const ordinal = ordinals[i];
          if (ordinal < 0) {
            // A separator carrying a newline is a hard break — the reference
            // headings wrap at fixed points, not wherever the measure lands.
            return token.includes("\n") ? (
              <br aria-hidden key={`br-${i}`} />
            ) : (
              <span aria-hidden key={`s-${i}`}>
                {token}
              </span>
            );
          }
          const start = ordinal * step;
          return (
            <Word
              end={Math.min(1, start + step * spread)}
              key={`w-${i}`}
              progress={scrollYProgress}
              start={start}
            >
              {token}
            </Word>
          );
        })}
      </MotionTag>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Odometer — the awards / featured-in numbers.

   In the capture the digits do not land together: at t=18.6s the years still
   read "202" while the index column shows 01, 02, 03, 0, 05. That is a reel
   per digit on a stagger, so each column settles on its own beat.
   ------------------------------------------------------------------------ */
const DIGITS = Array.from({ length: 10 }, (_, i) => i);

function Reel({ digit, delay, play }: { digit: number; delay: number; play: boolean }) {
  const reduce = useReducedMotion();

  return (
    <span className="hv2-digit">
      <motion.span
        animate={{ y: play ? `-${digit * 1.2}em` : "0em" }}
        className="hv2-digit__reel"
        initial={{ y: reduce ? `-${digit * 1.2}em` : "0em" }}
        transition={{ duration: reduce ? 0 : DUR.odometer, delay: reduce ? 0 : delay, ease: EASE }}
      >
        {DIGITS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </motion.span>
    </span>
  );
}

export function Odometer({
  value,
  pad = 0,
  className,
}: {
  value: number;
  pad?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const text = String(value).padStart(pad, "0");

  return (
    <span className={cn("hv2-awards__num", className)} ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {text.split("").map((char, i) => (
          <Reel
            delay={i * 0.09}
            digit={Number(char)}
            key={`${i}-${char}`}
            play={inView}
          />
        ))}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   RevealImage — the page's single image entrance.

   A photograph arriving by opacity alone reads flat. This uncovers it: the
   frame wipes open from the bottom edge while the picture itself settles back
   from a slight over-scale, so the crop appears to be *revealed* rather than
   faded in. Both halves are compositor-only (clip-path + transform).
   ------------------------------------------------------------------------ */
export function RevealImage({
  src,
  alt,
  className,
  delay = 0,
  priority = false,
  amount = AMOUNT.image,
}: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
  priority?: boolean;
  amount?: number;
}) {
  const reduce = useReducedMotion();

  // The trigger MUST live on an element that does not clip itself. Chrome
  // reports an empty intersection rect for a node under `clip-path: inset(100%)`,
  // so putting whileInView on the clipped layer deadlocks it exactly the way a
  // fully-masked line deadlocks: it hides itself, therefore it never enters the
  // viewport, therefore it never un-hides. The frame is the trigger; the layer
  // inside it does the clipping and inherits the variant.
  const clip: Variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }
    : {
        hidden: { clipPath: "inset(100% 0% 0% 0%)" },
        show: {
          clipPath: "inset(0% 0% 0% 0%)",
          transition: { duration: DUR.imageZoom, delay, ease: EASE },
        },
      };

  const settle: Variants = {
    hidden: { scale: reduce ? 1 : 1.18 },
    show: {
      scale: 1,
      transition: { duration: reduce ? 0 : DUR.imageZoom * 1.15, delay, ease: EASE },
    },
  };

  return (
    <motion.div
      className={cn("hv2-reveal", className)}
      initial="hidden"
      viewport={{ once: true, amount }}
      whileInView="show"
    >
      <motion.div className="hv2-reveal__clip" variants={clip}>
        <motion.img
          alt={alt}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          src={src}
          variants={settle}
        />
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   MaskLines — stacked lines of type wiping up from behind their own edge, one
   mask per line. Used for the founder names.

   The trigger deliberately sits on the *outer* element. Putting whileInView on
   the clipped inner span deadlocks: it starts translated fully below its
   overflow-hidden mask, so it has no visible area, so the intersection
   observer never fires, so it never animates back into view. The wrapper is
   unclipped, sees the viewport normally, and propagates variants down.
   ------------------------------------------------------------------------ */
const maskVariants: Variants = {
  hidden: { y: "108%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: DUR.maskLine, delay: i * 0.07, ease: EASE },
  }),
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function MaskLines({
  lines,
  className,
  amount = AMOUNT.reveal,
  /** Drive from a parent's variants instead of its own viewport trigger. */
  inherit = false,
}: {
  lines: readonly string[];
  className?: string;
  amount?: number;
  inherit?: boolean;
}) {
  const reduce = useReducedMotion();

  const trigger = inherit
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "show" as const,
        viewport: { once: true, amount },
      };

  return (
    <motion.span className={cn("block", className)} {...trigger}>
      {lines.map((line, i) => (
        <span className="hv2-hero__mask" key={line} style={{ display: "block" }}>
          <motion.span
            className="inline-block"
            custom={i}
            variants={reduce ? fadeVariants : maskVariants}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
