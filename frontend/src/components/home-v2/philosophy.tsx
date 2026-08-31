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

          {/* Heading and paragraph are wrapped as ONE child of the copy column,
              which is what lets `justify-content: space-between` still do its
              top-and-tail job: the eyebrow holds the top line, this block holds
              the bottom. Three loose children would have been spread evenly and
              opened a gap between the claim and its own evidence. */}
          <div className="hv2-philosophy__text">
            {/* The claim, and the only thing here set in the display weight.
                Still `ScrollWords`, so it keeps the per-word ink scrub it has
                always had — the reveal was never the problem, the uniform
                weight underneath it was. */}
            <ScrollWords
              as="h2"
              className="hv2-philosophy__heading"
              offset={["start 0.85", "center 0.6"]}
              spread={2.2}
              text={philosophy.heading}
            />
            {/* The detail, in a real paragraph at a real reading weight. It
                rises with the section rather than scrubbing word by word: two
                competing reveals in one column is one too many, and the numbers
                in here are meant to be read, not performed. */}
            <p className="hv2-philosophy__body" data-aos="hv2-rise" data-aos-delay="120">
              {philosophy.body}
            </p>
          </div>
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
