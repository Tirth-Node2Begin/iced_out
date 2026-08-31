"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  useVelocity,
} from "motion/react";
import { useRef } from "react";

import { RIBBON } from "@/components/new-woman/data";

/** Baseline travel, in pixels per second, with the page standing still. */
const DRIFT = 34;

/**
 * How much the page's own scroll adds to that drift.
 *
 * Small on purpose: at anything higher the words tear past on a flick and the
 * ribbon stops being readable, which is the only thing it is for.
 */
const PUSH = 0.16;

/** The furthest the scroll may push it, either way, in px/s. */
const PUSH_CAP = 320;

/**
 * The marquee under the hero.
 *
 * It runs on its own and the page's scroll velocity adds to it, so it reads as
 * something the scroll is driving rather than a loop playing beside it —
 * scrolling down speeds it up, scrolling up slows it and then reverses it.
 *
 * Two identical groups travel as one track and the offset is wrapped at half
 * the track's width, which is exactly one group: at the moment the first group
 * has fully left, the second is sitting where the first started, so resetting
 * to zero is invisible. Measured every frame rather than once, because the
 * group's width is set in `vw` and a resize changes it.
 */
export function Ribbon() {
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  /* px/s of scroll, softened and capped, as px/s of extra ribbon travel */
  const push = useTransform(velocity, (value) =>
    Math.max(-PUSH_CAP, Math.min(PUSH_CAP, value * PUSH)),
  );

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const el = track.current;
    if (!el) return;

    /* One group is half the track. Bail while it is still zero — the first
       frame can land before layout, and dividing into it would produce NaN and
       freeze the ribbon for the life of the page. */
    const span = el.scrollWidth / 2;
    if (span <= 0) return;

    const next = x.get() - ((DRIFT + push.get()) * delta) / 1000;
    /* A plain modulo keeps the sign of its operand, so a reversed ribbon would
       walk off to the right forever. This wraps into [-span, 0] either way. */
    x.set(-(((-next % span) + span) % span));
  });

  const group = (key: string) => (
    /* The second group is furniture, not content: it says the same words again
       so the loop can close, and a screen reader should hear them once. */
    <div aria-hidden={key === "b"} className="nw-ribbon__group" key={key}>
      {RIBBON.map((word, index) => (
        <span className="nw-ribbon__item" key={`${key}-${index}`}>
          {word}
        </span>
      ))}
    </div>
  );

  return (
    <div className="nw-ribbon">
      <motion.div className="nw-ribbon__track" ref={track} style={{ x }}>
        {group("a")}
        {group("b")}
      </motion.div>
    </div>
  );
}
