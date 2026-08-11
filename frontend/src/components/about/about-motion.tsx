"use client";

import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { Fragment, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const ABOUT_EASE = [0.22, 1, 0.36, 1] as const;

export function AboutReveal({
  children,
  className,
  delay = 0,
  y = 26,
  amount = 0.3,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      transition={{ duration: reduceMotion ? 0 : 0.72, delay, ease: ABOUT_EASE }}
      viewport={{ once: true, amount }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

type HeadingSegment = { text: string; light?: boolean };

const characterVariants: Variants = {
  hidden: { opacity: 0, y: "0.42em", filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: ABOUT_EASE },
  },
};

function PlainSegment({ segment }: { segment: HeadingSegment }) {
  return (
    <span className={segment.light ? "nh-light" : undefined}>
      {segment.text.split("\n").map((line, index, lines) => (
        <Fragment key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * The animated heading is split to the glyph, and every glyph is an
 * inline-block — which hands the line breaker a break opportunity between any
 * two letters. Left alone, a heading that is one word too wide for its column
 * wraps *inside* a word ("CONSEQU / ENCES."). Grouping the glyphs into a
 * nowrap word restores the only break opportunities type should have: the
 * spaces between words.
 */
function splitLine(line: string) {
  /* Kept with the split so the space survives as its own token and stays
     outside the nowrap boxes — that is what the breaker needs to see. */
  return line.split(/(\s+)/).filter(Boolean);
}

export function AboutSplitHeading({
  segments,
  className,
  as: Tag = "h2",
  delay = 0,
  stagger = 0.022,
}: {
  segments: HeadingSegment[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[Tag];

  if (reduceMotion) {
    return (
      <div ref={ref}>
        <Tag className={cn("nh-display", className)}>
          {segments.map((segment, index) => (
            <PlainSegment key={`${segment.text}-${index}`} segment={segment} />
          ))}
        </Tag>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <MotionTag
        animate={inView ? "show" : "hidden"}
        aria-label={segments.map((segment) => segment.text).join("")}
        className={cn("nh-display", className)}
        initial="hidden"
        transition={{ delayChildren: delay, staggerChildren: stagger }}
      >
        {segments.map((segment, segmentIndex) => (
          <span
            aria-hidden
            className={segment.light ? "nh-light" : undefined}
            key={`${segment.text}-${segmentIndex}`}
          >
            {segment.text.split("\n").map((line, lineIndex, lines) => (
              <Fragment key={`line-${segmentIndex}-${lineIndex}`}>
                {splitLine(line).map((token, tokenIndex) => {
                  /* A run of whitespace is left as plain text: it is the
                     break opportunity, so it must not sit inside a word. */
                  if (/^\s+$/.test(token)) {
                    return (
                      <Fragment key={`gap-${segmentIndex}-${lineIndex}-${tokenIndex}`}>
                        {token}
                      </Fragment>
                    );
                  }

                  return (
                    <span
                      className="nh-about-word"
                      key={`w-${segmentIndex}-${lineIndex}-${tokenIndex}`}
                    >
                      {Array.from(token).map((character, charIndex) => (
                        <motion.span
                          className="nh-about-char"
                          key={`${character}-${charIndex}`}
                          variants={characterVariants}
                        >
                          {character}
                        </motion.span>
                      ))}
                    </span>
                  );
                })}
                {lineIndex < lines.length - 1 ? <br key={`br-${lineIndex}`} /> : null}
              </Fragment>
            ))}
          </span>
        ))}
      </MotionTag>
    </div>
  );
}

export function AboutBlindsImage({
  src,
  alt,
  className,
  imgClassName,
  slices = 12,
  direction = "center",
  delay = 0,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  slices?: number;
  direction?: "center" | "down" | "up";
  delay?: number;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  /* Every slice carries `will-change: clip-path, transform` so the wipe stays
     off the main thread. The page mounts six of these — ~74 slices — and a
     promoted layer that has finished moving is pure cost for the rest of the
     scroll, so the flag is dropped once the last slice lands. */
  const [settled, setSettled] = useState(false);

  if (reduceMotion) {
    return (
      <div className={cn("nh-blinds", className)} ref={ref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className={imgClassName} decoding="async" src={src} />
      </div>
    );
  }

  const order = (index: number) => {
    if (direction === "down") return index;
    if (direction === "up") return slices - 1 - index;
    return Math.abs(index - (slices - 1) / 2);
  };

  /* The reveal is a stagger, so "finished" is the *last* slice to land, not the
     last callback to arrive — `order` decides which one that is. */
  const lastToLand = Array.from({ length: slices }, (_, i) => i).reduce((a, b) =>
    order(b) > order(a) ? b : a,
  );

  return (
    <div className={cn("nh-blinds", className)} data-settled={settled || undefined} ref={ref}>
      {Array.from({ length: slices }).map((_, index) => {
        const top = (index / slices) * 100;
        const bottom = 100 - ((index + 1) / slices) * 100;
        const closed = `inset(${top}% 100% ${bottom}% 0)`;
        const open = `inset(${top}% 0% ${bottom}% 0)`;
        const offset = index % 2 === 0 ? -34 : 34;

        return (
          <motion.div
            animate={inView ? { clipPath: open, x: 0 } : { clipPath: closed, x: offset }}
            className="nh-blinds__strip"
            initial={{ clipPath: closed, x: offset }}
            key={index}
            onAnimationComplete={
              index === lastToLand && inView ? () => setSettled(true) : undefined
            }
            transition={{
              duration: 0.78,
              delay: delay + order(index) * 0.055,
              ease: ABOUT_EASE,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={index === 0 ? alt : ""}
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
