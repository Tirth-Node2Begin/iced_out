"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState } from "react";

import { FOUNDERS } from "./data";
import { DUR, EASE, MaskLines } from "./motion";

/** The meta lines under the name — they settle after it, not with it. */
const metaVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  out: { opacity: 0, y: -10, transition: { duration: 0.28, ease: EASE } },
};

/**
 * Meet the founders — a pinned stage.
 *
 * The section holds one viewport while the roster advances through it: the
 * portrait crossfades from one founder to the next, and the text column never
 * moves — only its contents change. That keeps the eye in one place instead of
 * chasing four full-height blocks down the page.
 *
 * The portrait is scrubbed (continuous, tied directly to scroll position) while
 * the text is swapped (discrete, on the active index). Mixing the two is
 * deliberate: a crossfading image reads smooth at any scroll speed, but text
 * that dissolves mid-word reads broken — it wants a clean out-and-in.
 */
const COUNT = FOUNDERS.length;

/**
 * Motion binds a `useTransform` off `scrollYProgress` straight onto a WAAPI
 * scroll-driven animation, and WAAPI takes the input array as keyframe offsets:
 * they must sit inside [0, 1] and never decrease. The natural band maths here
 * overshoots at both ends (the first card wants to start before 0, the last to
 * finish after 1), so every range is clamped and then flattened before use —
 * without this the whole page throws on mount.
 */
function offsets(points: number[]) {
  const out = points.map((p) => Math.min(1, Math.max(0, p)));
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] < out[i - 1]) out[i] = out[i - 1];
  }
  return out;
}

/** Crossfade band for one portrait, with a soft overlap into its neighbours. */
function Portrait({
  founder,
  index,
  progress,
  reduce,
  active,
}: {
  founder: (typeof FOUNDERS)[number];
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
  active: number;
}) {
  const band = 1 / COUNT;
  const fade = band * 0.42;
  const start = index * band;
  const end = (index + 1) * band;

  const first = index === 0;
  const last = index === COUNT - 1;

  /* Every portrait's curve is declared across the FULL 0→1 of the runway, with
     its band as interior stops. Describing only the band and letting the ends
     clamp looks equivalent but is not: a range that stops short of 1 leaves the
     tail behaviour up to how the value is bound, and the first card — whose
     lead-in clamps onto 0 — ended up lingering at partial opacity well past its
     band, so three portraits were stacked mid-scroll. Pinning both endpoints
     removes the ambiguity: outside its band a portrait is exactly 0 (or exactly
     1, for the two on the ends, which have nothing to fade against). */
  const fadeRange = offsets([
    0,
    start - fade,
    start + fade * 0.35,
    end - fade * 0.35,
    end + fade,
    1,
  ]);
  const head = first ? 1 : 0;
  const tail = last ? 1 : 0;
  const opacity = useTransform(progress, fadeRange, [head, head, 1, 1, tail, tail]);

  const driftRange = offsets([0, start - fade, end + fade, 1]);
  // A touch of travel so the swap has direction rather than just dissolving.
  const y = useTransform(progress, driftRange, ["4%", "4%", "-4%", "-4%"]);
  const scale = useTransform(progress, driftRange, [1.06, 1.06, 1, 1]);

  return (
    <motion.img
      alt={`${founder.first} ${founder.last}`}
      className="hv2-founders__portrait"
      decoding="async"
      loading={index === 0 ? "eager" : "lazy"}
      src={founder.src}
      style={
        reduce
          ? { opacity: index === active ? 1 : 0 }
          : { opacity, y, scale }
      }
    />
  );
}

export function Founders() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // A short lead-in and lead-out so the first and last founder each get a
  // settled beat instead of changing the instant the section pins.
  const stage = useTransform(scrollYProgress, [0.05, 0.95], [0, COUNT - 0.001]);
  useMotionValueEvent(stage, "change", (v) => {
    const next = Math.max(0, Math.min(COUNT - 1, Math.floor(v)));
    setActive((prev) => (prev === next ? prev : next));
  });

  const founder = FOUNDERS[active];

  return (
    <section
      className="hv2-founders"
      id="team"
      ref={ref}
      style={{ height: `${COUNT * 100}svh` }}
    >
      <div className="hv2-founders__pin hv2-shell">
        {/* No AOS in this section. It is a pinned stage: everything inside is
            driven by scroll *position*, and a one-shot AOS reveal firing on a
            threshold cuts across that instead of running with it. */}
        <span className="hv2-founders__eyebrow hv2-eyebrow">Meet the founders</span>

        <div className="hv2-founders__stage">
          {FOUNDERS.map((f, i) => (
            <Portrait
              active={active}
              founder={f}
              index={i}
              key={f.index}
              progress={scrollYProgress}
              reduce={reduce}
            />
          ))}
        </div>

        <div className="hv2-founders__text">
          <AnimatePresence initial={false} mode="wait">
            {/* The card orchestrates its own children: the name wipes up from
                behind its mask line by line, then the meta settles under it.
                A single opacity fade on the whole block reads as a slideshow;
                staggering the parts makes each swap feel authored. */}
            <motion.div
              animate="show"
              className="hv2-founders__card"
              exit="out"
              initial="hidden"
              key={founder.index}
              transition={{ staggerChildren: reduce ? 0 : 0.06 }}
              variants={{
                hidden: {},
                show: {},
                // The group carries the exit. The masked name lines have no
                // `out` state of their own, so without this the card would be
                // yanked from the DOM with no fade at all.
                out: {
                  opacity: 0,
                  y: reduce ? 0 : -12,
                  transition: { duration: reduce ? 0 : 0.3, ease: EASE },
                },
              }}
            >
              <motion.span className="hv2-founder__index" variants={metaVariants}>
                {founder.index}
              </motion.span>

              <h3 className="hv2-founder__name">
                <MaskLines inherit lines={[founder.first, founder.last]} />
              </h3>

              <motion.div className="hv2-founder__role" variants={metaVariants}>
                {founder.role}
              </motion.div>

              <motion.p className="hv2-founder__bio hv2-body" variants={metaVariants}>
                {founder.bio}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Position within the roster — the only cue that the stage is paging. */}
        <div className="hv2-founders__ticks" aria-hidden>
          {FOUNDERS.map((f, i) => (
            <span
              className="hv2-founders__tick"
              data-on={i <= active ? "" : undefined}
              key={f.index}
            >
              <motion.i
                animate={{ scaleX: i <= active ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : DUR.reveal, ease: EASE }}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
