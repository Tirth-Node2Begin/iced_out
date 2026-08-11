"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { AboutBlindsImage, AboutReveal } from "@/components/about/about-motion";

export function AboutStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const ghostX = useTransform(scrollYProgress, [0, 1], ["-9%", "7%"]);
  const ghostY = useTransform(scrollYProgress, [0, 1], [70, -70]);

  return (
    <section className="nh-about-story nh-section" id="manifesto" ref={sectionRef}>
      <div className="nh-wrap">
        <div className="nh-about-story__stage">
          <motion.p
            aria-hidden
            className="nh-about-story__ghost"
            initial={reduceMotion ? false : { opacity: 0, y: "32%", scaleX: 1.06 }}
            style={reduceMotion ? undefined : { x: ghostX, y: ghostY }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, amount: 0.25 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
          >
            Intent
          </motion.p>

          <div className="nh-about-story__frame nh-about-story__frame--a">
            <AboutBlindsImage
              alt="Iced_out garments arranged as a monochrome still life"
              direction="down"
              slices={9}
              src="/images/product-still-life-v2.webp"
            />
            <span>Material study / 520 GSM</span>
          </div>

          <div className="nh-about-story__frame nh-about-story__frame--b">
            <AboutBlindsImage
              alt="Iced_out campaign silhouettes after dark"
              delay={0.12}
              slices={13}
              src="/images/iced-out-hero.webp"
            />
            <span>Night uniform / Field test 003</span>
          </div>

          <div className="nh-about-story__frame nh-about-story__frame--c">
            <AboutBlindsImage
              alt="Pieces from the first limited Iced_out drop"
              delay={0.2}
              direction="up"
              slices={9}
              src="/images/drop-001-products.webp"
            />
            <span>Drop 001 / 320 units maximum</span>
          </div>

          <AboutReveal className="nh-about-story__note nh-about-story__note--top" delay={0.25}>
            <p className="nh-eyebrow">Built in the quiet</p>
            <p className="nh-body">
              The work begins where the logo ends: hand feel, balance, recovery, repeat wear.
            </p>
          </AboutReveal>

          <AboutReveal className="nh-about-story__note nh-about-story__note--bottom" delay={0.32}>
            <p className="nh-body">
              A uniform should disappear when you wear it—and become unmistakable when you move.
            </p>
            <span>Studio note / 001</span>
          </AboutReveal>
        </div>

        <div className="nh-about-story__manifesto">
          <AboutReveal>
            <p className="nh-eyebrow">Iced_out is a study in restraint</p>
          </AboutReveal>
          <AboutReveal delay={0.12}>
            <p>
              Every release starts with one question: will this still earn its place after the
              moment has passed? If the answer is uncertain, it does not make the cut.
            </p>
          </AboutReveal>
          <AboutReveal delay={0.2}>
            <p>
              That standard gives us room to slow down, refine construction, and make limited
              runs that feel specific without becoming disposable.
            </p>
          </AboutReveal>
        </div>
      </div>
    </section>
  );
}
