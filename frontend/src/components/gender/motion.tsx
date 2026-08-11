"use client";

import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The motion primitives for /new-drop and /women.
 *
 * These are the /new-home primitives (new_style.md §11.1) with one change: the
 * OS reduced-motion preference is honoured *at the source*. The CSS block in
 * §6.10 only neuters `transition` and `@keyframes`; everything Motion applies
 * comes through as inline style and slips straight past it. §11.5 is the fix,
 * and it is implemented here rather than left as a note.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/* Reveal — the house entrance                                                */
/* -------------------------------------------------------------------------- */

export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  once = true,
  amount = 0.35,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  as?: "div" | "span" | "li";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.72, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* SplitHeading — the per-character blur-rise                                 */
/* -------------------------------------------------------------------------- */

export type Segment = { text: string; light?: boolean };

/* `y` is in em, never px: the rise then scales with the type size, so a 5rem
   hero headline and a 1.5rem card title read as the same gesture. */
const charVariants: Variants = {
  hidden: { opacity: 0, y: "0.42em", filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: EASE_OUT },
  },
};

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
  const reduce = useReducedMotion();

  const MotionTag = motion[Tag];
  const label = segments.map((segment) => segment.text).join("");

  if (reduce) {
    return (
      <MotionTag
        className={cn("gx-display", className)}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once, amount: 0.4 }}
        transition={{ duration: 0.2 }}
      >
        {segments.map((segment, index) => (
          <span className={segment.light ? "gx-light" : undefined} key={`${segment.text}-${index}`}>
            {segment.text.split("\n").map((line, lineIndex) => (
              <span key={`${line}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {line}
              </span>
            ))}
          </span>
        ))}
      </MotionTag>
    );
  }

  let index = -1;

  return (
    <div ref={ref}>
      <MotionTag
        aria-label={label}
        className={cn("gx-display", className)}
        animate={inView ? "show" : "hidden"}
        initial="hidden"
        transition={{ delayChildren: delay, staggerChildren: stagger }}
      >
        {segments.map((segment, segmentIndex) => (
          <span
            aria-hidden
            className={segment.light ? "gx-light" : undefined}
            key={`${segment.text}-${segmentIndex}`}
          >
            {tokenise(segment.text).map((token, tokenIndex) => {
              if (token === "\n") return <br key={`br-${segmentIndex}-${tokenIndex}`} />;

              /**
               * Whitespace is emitted as a bare text node, and words as one
               * inline-block each.
               *
               * Every character has to be its own inline-block to animate, and
               * a line box will happily break between two of them — which is
               * how a headline ends up reading "Men Wh / o Move". Boxing the
               * word gives the line breaker one unbreakable unit; leaving the
               * spaces as real text is what gives it somewhere to break at all.
               */
              if (token === " ") return " ";

              return (
                <span
                  className="inline-block whitespace-pre"
                  key={`w-${segmentIndex}-${tokenIndex}`}
                >
                  {Array.from(token).map((char) => {
                    index += 1;
                    return (
                      <motion.span
                        className="inline-block whitespace-pre"
                        key={`${char}-${index}`}
                        variants={charVariants}
                      >
                        {char}
                      </motion.span>
                    );
                  })}
                </span>
              );
            })}
          </span>
        ))}
      </MotionTag>
    </div>
  );
}

/**
 * Break a segment into words, single spaces, and newlines, in source order.
 * Runs of whitespace collapse to one `" "` because that is what the rendered
 * line would have shown anyway.
 */
function tokenise(text: string): string[] {
  return text
    .split(/(\n|[^\S\n]+)/)
    .filter(Boolean)
    .map((token) => (/^[^\S\n]+$/.test(token) ? " " : token));
}

/* -------------------------------------------------------------------------- */
/* WordRamp — words resolve OUT of a ghost, not out of nothing                */
/* -------------------------------------------------------------------------- */

/**
 * `hidden.opacity` is 0.06, not 0. The words sit ghosted on the surface and
 * *resolve*; at 0.075s apart the last word is still faint while the first is
 * solid, and that lag is the whole effect. Setting it to 0 kills it.
 */
export function WordRamp({
  text,
  className,
  as: Tag = "h3",
}: {
  text: string;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag];
  const words = text.split(" ");

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.45 }}
      transition={{ staggerChildren: reduce ? 0 : 0.075 }}
    >
      {words.map((word, index) => (
        <motion.span
          className="inline-block"
          key={`${word}-${index}`}
          variants={{
            hidden: reduce ? { opacity: 0 } : { opacity: 0.06, y: 12 },
            show: {
              opacity: 1,
              y: 0,
              transition: reduce ? { duration: 0.2 } : { duration: 0.7, ease: EASE_OUT },
            },
          }}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </MotionTag>
  );
}

/* -------------------------------------------------------------------------- */
/* Blinds — the signature image entrance                                      */
/* -------------------------------------------------------------------------- */

export function Blinds({
  src,
  alt,
  slices = 14,
  className,
  imgClassName,
  style,
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
  style?: React.CSSProperties;
  priority?: boolean;
  delay?: number;
  once?: boolean;
  direction?: "center" | "down" | "up";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.2 });
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={cn("nh-blinds", className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className={imgClassName} decoding="async" src={src} />
      </div>
    );
  }

  const order = (i: number) => {
    if (direction === "down") return i;
    if (direction === "up") return slices - 1 - i;
    // centre-out is the default: the middle band opens first
    return Math.abs(i - (slices - 1) / 2);
  };

  return (
    <div className={cn("nh-blinds", className)} ref={ref} style={style}>
      {Array.from({ length: slices }).map((_, i) => {
        // The band AND the wipe share one inset(), so adjacent slices resolve
        // to exactly the same edge. Stacking cropped boxes instead leaves
        // hairline seams wherever the percentages round apart.
        const top = (i / slices) * 100;
        const bottom = 100 - ((i + 1) / slices) * 100;
        const shut = `inset(${top}% 100% ${bottom}% 0)`;
        const open = `inset(${top}% 0% ${bottom}% 0)`;
        const offset = i % 2 === 0 ? -34 : 34;

        return (
          <motion.div
            animate={inView ? { clipPath: open, x: 0 } : { clipPath: shut, x: offset }}
            className="nh-blinds__strip"
            initial={{ clipPath: shut, x: offset }}
            key={i}
            transition={{ duration: 0.78, delay: delay + order(i) * 0.055, ease: EASE_OUT }}
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
