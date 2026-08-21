"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { CROPS, type AudienceContent } from "@/components/gender/data";
import { Reveal, SplitHeading } from "@/components/gender/motion";

/**
 * The full-width lifestyle band.
 *
 * Two scroll-linked transforms, on two elements: the photograph rises through
 * its own overscan while the ghost marquee runs the opposite way behind the
 * copy. The band scrims top and bottom into `--nh-surface` — never into white,
 * or the section would end in a bright halo (§9 rule 8).
 */
export function LifestyleBanner({
  content,
  href = "/collections/view?slug=after-hours",
}: {
  content: AudienceContent;
  href?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const marqueeX = useTransform(scrollYProgress, [0, 1], ["6%", "-42%"]);

  const { band } = content;
  const crop = CROPS[band.crop];

  return (
    <section className="gx-band" ref={ref}>
      <motion.div className="gx-band__media" style={reduce ? undefined : { y: mediaY }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          decoding="async"
          loading="lazy"
          src={crop.src}
          style={{ "--op": crop.op } as React.CSSProperties}
        />
      </motion.div>

      <span className="gx-band__scrim" />

      {/* the -50% centring lives in the transform, not the stylesheet: Motion
          owns this element's `transform` outright and would overwrite it */}
      <motion.p
        aria-hidden
        className="gx-ghostType gx-band__marquee"
        style={reduce ? { x: "6%", y: "-50%" } : { x: marqueeX, y: "-50%" }}
      >
        {/* repeated so the band never runs out of type as it travels */}
        {`${band.marquee} `.repeat(4)}
      </motion.p>

      <div className="gx-wrap gx-band__copy">
        <Reveal>
          <p className="gx-eyebrow">{band.eyebrow}</p>
        </Reveal>
        <SplitHeading
          className="gx-band__title"
          segments={[{ text: band.heavy }, { text: band.light, light: true }]}
        />
        <Reveal delay={0.15}>
          <p className="gx-body">{band.body}</p>
        </Reveal>
        <Reveal delay={0.24}>
          <Link className="gx-pill gx-pill--glass" href={href}>
            {band.cta}
            <ArrowUpRight aria-hidden size={14} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
