"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";

import { EASE_OUT, Reveal, SplitHeading } from "@/components/new-home/motion-primitives";
import { CLOSING } from "@/components/new-woman/data";
import { useMotionScale } from "@/components/new-woman/use-motion-scale";

/**
 * The pull quote.
 *
 * Line by line out of a mask rather than character by character: the headline
 * above it is already a character reveal, and running the same move twice in
 * one viewport reads as a tic. Each line is its own overflow box, so the rise
 * happens behind an edge instead of through a fade.
 */
function Quote() {
  const ref = useRef<HTMLQuoteElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();

  return (
    <blockquote className="nw-close__quote" ref={ref}>
      <p className="nw-close__quoteLines">
        {CLOSING.quote.lines.map((line, index) => (
          <span className="nw-close__line" key={line}>
            <motion.span
              animate={inView ? { y: "0%", opacity: 1 } : undefined}
              className="nw-close__lineInner"
              initial={{ y: "110%", opacity: 0 }}
              transition={{
                duration: reduce ? 0.2 : 0.86,
                delay: reduce ? 0 : index * 0.08,
                ease: EASE_OUT,
              }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </p>
      <cite className="nw-close__credit">{CLOSING.quote.credit}</cite>
    </blockquote>
  );
}

/**
 * Fit and care, as an accordion.
 *
 * Only one answer is open at a time — these are four separate questions and a
 * reader is answering one of them, not comparing all four. The panel's height
 * is animated by grid template rows rather than max-height, so a long answer
 * and a short one open at the same speed instead of the long one lagging.
 */
function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="nw-faq">
      {CLOSING.faq.map((item, index) => {
        const isOpen = open === index;
        return (
          <div className="nw-faq__item" data-open={isOpen} key={item.q}>
            <button
              aria-controls={`nw-faq-${index}`}
              aria-expanded={isOpen}
              className="nw-faq__head"
              onClick={() => setOpen(isOpen ? null : index)}
              type="button"
            >
              <span aria-hidden className="nw-faq__num">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="nw-faq__q">{item.q}</span>
              <span aria-hidden className="nw-faq__sign" />
            </button>

            {/* Kept in the tree rather than unmounted: the closing animation
                needs something to close, and an answer that vanishes on the
                first frame reads as a jump. */}
            <div className="nw-faq__body" id={`nw-faq-${index}`} role="region">
              <div className="nw-faq__bodyInner">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 04 — the close: the studio's one claim, the four questions a first order
 * asks, and the band that sends a reader back up to the edit.
 *
 * The band is the only full-bleed photograph on the page that carries type over
 * it. Its wash is weighted to the left because the copy sits in that half and
 * the photograph's subject stands in the other — so nothing is ever set over a
 * face, at any width.
 */
export function Closing() {
  const bandRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: bandRef,
    offset: ["start end", "end start"],
  });
  /* The photograph drifts inside its own frame while the band crosses the
     viewport — the frame clips, so the movement never shows an edge.

     Scaled rather than switched off, so the motion values stay on the elements
     and the server's markup matches the client's. See `useMotionScale`. */
  const scale = useMotionScale();
  const mediaY = useTransform(scrollYProgress, [0, 1], [`${-6 * scale}%`, `${6 * scale}%`]);
  const ghostX = useTransform(scrollYProgress, [0, 1], [`${-3 * scale}%`, `${3 * scale}%`]);

  return (
    <section className="nw-close">
      <div className="nh-wrap">
        <div className="nw-close__grid">
          <Quote />

          <div className="nw-close__faq">
            <Reveal>
              <p className="nw-kicker">{CLOSING.faqEyebrow}</p>
            </Reveal>
            <Faq />
          </div>
        </div>

        <div className="nw-band" ref={bandRef}>
          <motion.div className="nw-band__media" style={{ y: mediaY }}>
            {/* The crop rides the image rather than the wrapper: the wrapper is
                carrying a motion value, and mixing custom properties into that
                style object is not something Motion's types accept. `.nw-fit`
                reads both from the element it is on. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={CLOSING.band.shot.alt}
              className="nw-fit"
              decoding="async"
              draggable={false}
              loading="lazy"
              src={CLOSING.band.shot.src}
              style={
                {
                  "--nw-op": CLOSING.band.shot.op,
                  "--nw-zoom": CLOSING.band.shot.zoom,
                } as CSSProperties
              }
            />
          </motion.div>

          <span aria-hidden className="nw-band__wash" />

          <motion.p
            aria-hidden
            className="nw-band__ghost"
            style={{ x: ghostX }}
          >
            {CLOSING.band.ghost}
          </motion.p>

          <div className="nw-band__inner">
            <Reveal>
              <p className="nw-kicker">The women&rsquo;s edit</p>
            </Reveal>

            <SplitHeading className="nw-band__title" segments={CLOSING.band.heading} />

            <Reveal delay={0.12}>
              <p className="nw-lede">{CLOSING.band.body}</p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="nw-band__ctas">
                {CLOSING.band.ctas.map((cta, index) => (
                  <Link
                    className={`nw-btn ${index === 0 ? "nw-btn--solid" : "nw-btn--ghost"}`}
                    href={cta.href}
                    key={cta.href}
                  >
                    {cta.label}
                    <span aria-hidden className="nw-btn__arrow">
                      <ArrowUpRight size={15} strokeWidth={1.6} />
                    </span>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
