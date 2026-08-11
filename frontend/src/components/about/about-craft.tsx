"use client";

import { motion, useInView, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ABOUT_EASE, AboutReveal, AboutSplitHeading } from "@/components/about/about-motion";

/**
 * Each step owns a frame. The sticky panel holds all four stacked, and the one
 * belonging to the step in view is the one that is inked — so the picture
 * changes as 01 → 02 → 03 → 04 complete, rather than a single crop sitting
 * there for the whole chapter.
 */
const steps = [
  {
    number: "01",
    eyebrow: "Material",
    title: "Start with the hand.",
    text: "We test density, recovery, drape, and abrasion before a silhouette is allowed to exist.",
    meta: "Touch / Tension / Time",
    image: "/images/home-v2/product-01.jpg",
    alt: "Heavyweight fabric study under raking studio light",
  },
  {
    number: "02",
    eyebrow: "Form",
    title: "Cut for the moving body.",
    text: "Proportion is tuned in motion: reach, stride, sit, layer, repeat. Stillness is only one state.",
    meta: "Range / Balance / Stack",
    image: "/images/home-v2/product-02.jpg",
    alt: "Layered Iced_out silhouette photographed mid-movement",
  },
  {
    number: "03",
    eyebrow: "Trial",
    title: "Review until quiet.",
    text: "Three construction passes remove friction, excess, and decorative decisions that do not work.",
    meta: "Prototype / Wear / Refine",
    image: "/images/home-v2/product-03.jpg",
    alt: "Construction detail from the third prototype pass",
  },
  {
    number: "04",
    eyebrow: "Edition",
    title: "Release less. Mean more.",
    text: "Runs stay intentionally small, letting each drop remain specific and every revision stay accountable.",
    meta: "Numbered / Limited / Recorded",
    image: "/images/home-v2/product-04.jpg",
    alt: "A finished piece from the numbered Drop 001 run",
  },
];

export function AboutCraft() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  /* Only the rail reads scroll directly — which frame is showing is decided by
     which step is actually in the reader's band, not by a fraction of the
     section, so the swap lands on the step rather than near it. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 70%", "end 70%"],
  });

  return (
    <section className="nh-about-craft nh-section" ref={sectionRef}>
      <div className="nh-wrap">
        <div className="nh-about-craft__heading">
          <AboutReveal>
            <p className="nh-eyebrow">02 / From weight to wear</p>
          </AboutReveal>
          <AboutSplitHeading
            className="nh-about-sectionTitle"
            segments={[
              { text: "Built slowly.\n" },
              { text: "Worn hard.", light: true },
            ]}
          />
        </div>

        <div className="nh-about-craft__layout">
          <div className="nh-about-craft__sticky">
            <div className="nh-about-craft__media">
              {steps.map((step, index) => (
                <motion.div
                  animate={{
                    opacity: index === active ? 1 : 0,
                    /* The outgoing frame settles back a touch while the
                       incoming one arrives at rest — the two move against each
                       other, so the change reads as a cut being made rather
                       than a dissolve between two stills. */
                    scale: reduceMotion ? 1 : index === active ? 1 : 1.05,
                  }}
                  className="nh-about-craft__frame"
                  initial={false}
                  key={step.image}
                  transition={{ duration: reduceMotion ? 0 : 0.9, ease: ABOUT_EASE }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={step.alt}
                    decoding="async"
                    loading={index === 0 ? "eager" : "lazy"}
                    src={step.image}
                  />
                </motion.div>
              ))}

              <div className="nh-about-craft__mediaShade" />
              <div className="nh-about-craft__crosshair" aria-hidden>
                <span />
                <span />
              </div>
              <div className="nh-about-craft__mediaMeta">
                <span>Construction log / {steps[active].number}</span>
                <span>{steps[active].eyebrow}</span>
              </div>
            </div>
          </div>

          <div className="nh-about-craft__steps">
            <div aria-hidden className="nh-about-craft__rail">
              <motion.span style={reduceMotion ? undefined : { scaleY: scrollYProgress }} />
            </div>
            {steps.map((step, index) => (
              <CraftStep index={index} key={step.number} onEnter={setActive} step={step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CraftStep({
  step,
  index,
  onEnter,
}: {
  step: (typeof steps)[number];
  index: number;
  onEnter: (index: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  /* The band is the middle of the viewport, so a step claims the frame when it
     is the one being read — not when its top edge clips in at the bottom. */
  const inBand = useInView(ref, { margin: "-45% 0px -45% 0px" });

  useEffect(() => {
    if (inBand) onEnter(index);
  }, [inBand, index, onEnter]);

  return (
    <motion.article
      className="nh-about-craft__step"
      data-active={inBand || undefined}
      initial={reduceMotion ? false : { opacity: 0.18, y: 24 }}
      ref={ref}
      transition={{ duration: reduceMotion ? 0 : 0.72, ease: ABOUT_EASE }}
      viewport={{ once: true, amount: 0.45 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="nh-about-craft__stepHead">
        <span>{step.number}</span>
        <p className="nh-eyebrow">{step.eyebrow}</p>
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      <span className="nh-about-craft__stepMeta">{step.meta}</span>
    </motion.article>
  );
}
