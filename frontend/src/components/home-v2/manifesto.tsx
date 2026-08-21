"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { useRef } from "react";

import { useCopy } from "./copy";
import { DUR, EASE, ScrollWords } from "./motion";

/**
 * The statement panel: a full-height field with the run of years pinned to
 * either gutter on the vertical midline, and the sentence inking in word by
 * word as it crosses the middle of the viewport.
 *
 * The rails are AOS (one-shot, nothing scroll-linked about them); the
 * statement is Motion, because its colour is scrubbed against scroll position
 * rather than triggered once.
 */
export function Manifesto({ compact = false }: { compact?: boolean }) {
  const { manifesto } = useCopy();
  const reduce = useReducedMotion();

  const railMotion = {
    hidden: (side: "left" | "right") => ({
      opacity: 0,
      x: reduce ? 0 : side === "left" ? -16 : 16,
      y: reduce ? 0 : 10,
    }),
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: reduce ? 0.3 : 0.72, ease: EASE },
    },
  };

  return (
    <section className={`hv2-manifesto hv2-shell${compact ? " hv2-manifesto--compact" : ""}`}>
      <motion.span
        className="hv2-manifesto__rail hv2-manifesto__rail--from"
        custom="left"
        initial="hidden"
        variants={railMotion}
        viewport={{ once: true, amount: 0.55 }}
        whileInView="show"
      >
        {manifesto.from}
      </motion.span>

      {compact ? (
        <CompactManifestoText text={manifesto.statement} />
      ) : (
        <ScrollWords
          className="hv2-manifesto__text"
          offset={["start 0.82", "center 0.42"]}
          spread={2.4}
          text={manifesto.statement}
        />
      )}

      <motion.span
        className="hv2-manifesto__rail hv2-manifesto__rail--to"
        custom="right"
        initial="hidden"
        transition={{ delay: reduce ? 0 : 0.08 }}
        variants={railMotion}
        viewport={{ once: true, amount: 0.55 }}
        whileInView="show"
      >
        {manifesto.to}
      </motion.span>
    </section>
  );
}

function CompactManifestoText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "end 0.45"],
  });

  const tokens = text.split(/(\s+)/);
  let seen = 0;
  const ordinals = tokens.map((token) => (token.trim().length ? seen++ : -1));
  const step = 1 / Math.max(1, seen);

  const parent: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: reduce ? 0 : 0.05,
        staggerChildren: reduce ? 0 : 0.035,
      },
    },
  };

  return (
    <div ref={ref}>
      <motion.p
        aria-label={text}
        className="hv2-manifesto__text hv2-manifesto__text--rise"
        initial="hidden"
        variants={parent}
        viewport={{ once: true, amount: 0.58 }}
        whileInView="show"
      >
        {tokens.map((token, i) => {
          const ordinal = ordinals[i];
          if (ordinal < 0) {
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
            <CompactWord
              end={Math.min(1, start + step * 2.05)}
              key={`w-${i}`}
              progress={scrollYProgress}
              reduce={reduce}
              start={start}
            >
              {token}
            </CompactWord>
          );
        })}
      </motion.p>
    </div>
  );
}

function CompactWord({
  children,
  end,
  progress,
  reduce,
  start,
}: {
  children: string;
  end: number;
  progress: MotionValue<number>;
  reduce: boolean | null;
  start: number;
}) {
  const color = useTransform(
    progress,
    [start, end],
    reduce ? ["var(--hv2-ink)", "var(--hv2-ink)"] : ["var(--hv2-dim)", "var(--hv2-ink)"],
  );

  const word: Variants = reduce
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.3 } },
      }
    : {
        hidden: { y: "118%", opacity: 0 },
        show: {
          y: "0%",
          opacity: 1,
          transition: { duration: DUR.maskLine, ease: EASE },
        },
      };

  return (
    <span className="hv2-manifesto__wordMask">
      <motion.span className="hv2-manifesto__word" style={{ color }} variants={word}>
        {children}
      </motion.span>
    </span>
  );
}
