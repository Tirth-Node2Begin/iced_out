"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import type { AudienceContent } from "@/components/gender/data";
import { Reveal, SplitHeading } from "@/components/gender/motion";

/**
 * The collection introduction — the first dark section, and the handover from
 * the light hero plate.
 *
 * The oversized ghost word drifts on scroll (§6.3) and reveals from a single
 * shared trigger. Its `y` is expressed in `%` so the rise scales with the type,
 * which is set in `vw`.
 */
export function CollectionIntro({ content }: { content: AudienceContent }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  /* The word is centred by the transform itself (`-50%` ± the drift) rather
     than by CSS: a `translateX(-50%)` in the stylesheet would be overwritten
     the moment Motion writes its own transform to the same element. */
  const ghostX = useTransform(scrollYProgress, [0, 1], ["-56%", "-44%"]);
  const ghostY = useTransform(scrollYProgress, [0, 1], [70, -70]);

  const { intro } = content;

  return (
    <section className="gx-section gx-intro" ref={ref}>
      {/* parallax on the wrapper, entrance on the word — one transform each */}
      <motion.div
        aria-hidden
        className="gx-intro__ghost"
        style={reduce ? { x: "-50%" } : { x: ghostX, y: ghostY }}
      >
        <motion.p
          className="gx-ghostType"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "34%", scaleX: 1.08 }}
          transition={reduce ? { duration: 0.3 } : { duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.25 }}
          whileInView={{ opacity: 1, y: "0%", scaleX: 1 }}
        >
          {intro.ghost}
        </motion.p>
      </motion.div>

      <div className="gx-wrap gx-intro__inner">
        <div>
          <Reveal>
            <p className="gx-eyebrow">{intro.eyebrow}</p>
          </Reveal>
          <SplitHeading
            className="gx-intro__title"
            segments={[{ text: intro.heavy }, { text: intro.light, light: true }]}
          />
        </div>

        <div className="gx-intro__aside">
          <Reveal delay={0.15}>
            <p className="gx-body">{intro.body}</p>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="gx-body">{intro.note}</p>
          </Reveal>
        </div>
      </div>

      <div className="gx-wrap">
        <div className="gx-intro__specs" style={{ marginTop: "clamp(2rem, 4vw, 3.5rem)" }}>
          {intro.specs.map((spec, index) => (
            <Reveal className="gx-intro__spec" delay={0.08 * index} key={spec.label}>
              <b>{spec.value}</b>
              <span>{spec.label}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
