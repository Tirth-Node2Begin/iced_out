"use client";

import { motion, useInView, type Variants } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   The house reveal: opacity 0 -> 1 with a short rise. Measured off the source
   at ~640ms with a heavy out-quint feel.
   ------------------------------------------------------------------------- */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  once = true,
  amount = 0.35,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  amount?: number;
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

/* ---------------------------------------------------------------------------
   Split heading.

   In the source every headline lands in two visual registers: the opening
   clause is the heavy cut, the closing clause is the light/wide cut of the
   same family. Characters wipe in left-to-right behind a mask while the
   weight settles — that weight settle is the detail that sells it.
   ------------------------------------------------------------------------- */
export type Segment = { text: string; light?: boolean };

const charVariants: Variants = {
  hidden: { opacity: 0, y: "0.42em", filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: EASE_OUT },
  },
};

/**
 * A segment split into words, single spaces, and hard breaks — each kept as its
 * own token so the caller can decide which of them a line may break at.
 *
 * Runs of whitespace collapse to one token because the headline is rendered as
 * inline-blocks, where a run of spaces would otherwise survive as several
 * separate break opportunities in a row.
 */
function tokenize(text: string) {
  return text.split(/(\n|[ \t]+)/).flatMap((part) => {
    if (part === "") return [];
    if (part === "\n") return ["\n"];
    if (/^[ \t]+$/.test(part)) return [" "];
    return [part];
  });
}

export function SplitHeading({
  segments,
  className,
  as: Tag = "h2",
  delay = 0,
  stagger = 0.022,
  once = true,
}: {
  segments: Segment[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.4 });

  const MotionTag = motion[Tag];

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
            aria-hidden
            className={segment.light ? "nh-light" : undefined}
            key={`${segment.text}-${sIdx}`}
          >
            {/* Characters animate one at a time, but they wrap a WORD at a time.
                Every char is its own inline-block, and inline-blocks are
                individually breakable — left loose, a headline breaks between
                letters the moment its column narrows ("SHADOW C / ARGO 02").
                Each word is boxed in a nowrap inline-block so the line can only
                break at the spaces BETWEEN those boxes, which is where a reader
                expects it. The spaces are emitted outside the boxes for exactly
                that reason: they are the break opportunities. */}
            {tokenize(segment.text).map((token, tIdx) => {
              if (token === "\n") return <br key={tIdx} />;

              if (token === " ") {
                return (
                  <motion.span
                    className="inline-block whitespace-pre"
                    key={tIdx}
                    variants={charVariants}
                  >
                    {" "}
                  </motion.span>
                );
              }

              return (
                <span className="inline-block whitespace-nowrap" key={tIdx}>
                  {Array.from(token).map((char, cIdx) => (
                    <motion.span
                      className="inline-block whitespace-pre"
                      key={cIdx}
                      variants={charVariants}
                    >
                      {char}
                    </motion.span>
                  ))}
                </span>
              );
            })}
          </span>
        ))}
      </MotionTag>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Blinds reveal — the signature move of the whole page.

   Every hero image and every editorial image enters as a stack of horizontal
   slices that wipe open on a stagger, so the picture assembles itself in
   bands rather than fading. Slice count is a prop because the source uses a
   coarser stack on the small editorial frames than on the hero.
   ------------------------------------------------------------------------- */
export function BlindsImage({
  src,
  alt,
  slices = 14,
  className,
  imgClassName,
  priority = false,
  delay = 0,
  once = true,
  direction = "center",
}: {
  src: string;
  alt: string;
  slices?: number;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  delay?: number;
  once?: boolean;
  direction?: "center" | "down" | "up";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.2 });

  const order = (i: number) => {
    if (direction === "down") return i;
    if (direction === "up") return slices - 1 - i;
    // centre-out: the source opens from the middle band outwards
    return Math.abs(i - (slices - 1) / 2);
  };

  return (
    <div className={cn("nh-blinds", className)} ref={ref}>
      {Array.from({ length: slices }).map((_, i) => {
        // Each slice is a full-size copy of the image and BOTH the band and
        // the wipe live in one inset(). Sharing a single box means adjacent
        // bands resolve to exactly the same edge; stacking cropped boxes
        // instead leaves white hairlines wherever the percentages round apart.
        const top = (i / slices) * 100;
        const bottom = 100 - ((i + 1) / slices) * 100;
        const shut = `inset(${top}% 100% ${bottom}% 0)`;
        const open = `inset(${top}% 0% ${bottom}% 0)`;
        const offset = i % 2 === 0 ? -34 : 34;

        return (
          <motion.div
            animate={
              inView ? { clipPath: open, x: 0 } : { clipPath: shut, x: offset }
            }
            className="nh-blinds__strip"
            initial={{ clipPath: shut, x: offset }}
            key={i}
            transition={{
              duration: 0.78,
              delay: delay + order(i) * 0.055,
              ease: EASE_OUT,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={i === 0 ? alt : ""}
              className={imgClassName}
              decoding="async"
              loading={priority ? "eager" : "lazy"}
              src={src}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
