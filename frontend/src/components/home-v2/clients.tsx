"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { CLIENTS } from "./data";
import { RevealImage, ScrollWords } from "./motion";

/**
 * Selected clients.
 *
 * The roster is the same ink-in-on-scroll treatment as the manifesto, but one
 * name per step rather than one word — at t=21.0s in the capture the top entry
 * is still grey while everything under it has landed.
 *
 * Each row also nudges right under the pointer. It is a list of real clients,
 * so the rows should feel touchable even though only the whole block is a link
 * target; the shift is small enough not to disturb the hairlines.
 */
export function Clients() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const photoY = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);

  return (
    <section className="hv2-clients hv2-shell" id="clients" ref={ref}>
      <div className="hv2-clients__grid">
        <div>
          <p className="hv2-clients__copy hv2-body" data-aos="hv2-rise">
            {CLIENTS.body}
          </p>

          <motion.div style={reduce ? undefined : { y: photoY }}>
            <RevealImage
              alt={CLIENTS.image.alt}
              className="hv2-clients__photo"
              src={CLIENTS.image.src}
            />
          </motion.div>
        </div>

        <div>
          <p className="hv2-eyebrow" data-aos="hv2-rise">
            {CLIENTS.eyebrow}
          </p>

          <ul className="hv2-clients__list">
            {CLIENTS.names.map((name) => (
              <motion.li
                className="hv2-clients__item"
                key={name}
                whileHover={reduce ? undefined : { x: 14 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              >
                <ScrollWords
                  as="span"
                  offset={["start 0.9", "start 0.62"]}
                  spread={1.4}
                  text={name}
                />
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
