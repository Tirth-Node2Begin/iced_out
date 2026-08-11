"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

import {
  AboutBlindsImage,
  AboutReveal,
  AboutSplitHeading,
} from "@/components/about/about-motion";

export function AboutClosing() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const wordX = useTransform(scrollYProgress, [0, 1], ["7%", "-9%"]);

  return (
    <section className="nh-about-closing nh-section" ref={sectionRef}>
      <div className="nh-wrap">
        <div className="nh-about-closing__card">
          <motion.div
            className="nh-about-closing__media"
            style={reduceMotion ? undefined : { y: mediaY }}
          >
            <AboutBlindsImage
              alt="Iced_out campaign portrait emerging from shadow"
              direction="up"
              slices={14}
              src="/images/iced-out-hero@960.webp"
            />
          </motion.div>
          <div className="nh-about-closing__shade" />
          <motion.p
            aria-hidden
            className="nh-about-closing__ghost"
            style={reduceMotion ? undefined : { x: wordX }}
          >
            After dark
          </motion.p>

          <div className="nh-about-closing__content">
            <AboutReveal>
              <p className="nh-eyebrow">03 / The standard</p>
            </AboutReveal>
            <AboutSplitHeading
              className="nh-about-closing__title"
              segments={[
                { text: "Made to disappear.\n" },
                { text: "Built to be remembered.", light: true },
              ]}
            />
            <AboutReveal className="nh-about-closing__foot" delay={0.18}>
              <p>
                The next uniform is already in motion. Enter Drop 001 or start a conversation
                with the studio.
              </p>
              <div>
                <Link className="nh-pill nh-pill--dark" href="/new-drop">
                  Shop the drop <ArrowUpRight aria-hidden size={15} />
                </Link>
                <Link className="nh-pill nh-pill--light" href="/contact">
                  Contact studio
                </Link>
              </div>
            </AboutReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
