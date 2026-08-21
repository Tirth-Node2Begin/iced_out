"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { useCopy } from "./copy";
import { RevealImage, ScrollWords } from "./motion";

/**
 * Philosophy — the first colour break on the page: the ground drops to the
 * lighter surface and stays there until the founders.
 *
 * Two columns, both centred on the same axis: the statement holds the left, one
 * tall picture holds the right. The capture also carried a small greyscale
 * inset hanging off the bottom-left, but it left a large dead area beside the
 * copy and bled off the section edge, so the section reads better as a clean
 * pair. The picture drifts slightly against the scroll to keep the block from
 * sitting flat.
 */
export function Philosophy() {
  const { philosophy } = useCopy();
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const mainY = useTransform(scrollYProgress, [0, 1], ["6%", "-6%"]);

  return (
    <section className="hv2-philosophy hv2-shell" id="studio" ref={ref}>
      <div className="hv2-philosophy__grid">
        <div className="hv2-philosophy__copy">
          <p className="hv2-eyebrow" data-aos="hv2-rise">
            {philosophy.eyebrow}
          </p>
          <ScrollWords
            className="hv2-philosophy__statement"
            offset={["start 0.85", "center 0.55"]}
            spread={2.2}
            text={philosophy.body}
          />
        </div>

        <motion.div
          className="hv2-philosophy__mainWrap"
          style={reduce ? undefined : { y: mainY }}
        >
          <RevealImage
            alt={philosophy.main.alt}
            className="hv2-philosophy__main"
            src={philosophy.main.src}
          />
        </motion.div>
      </div>
    </section>
  );
}
