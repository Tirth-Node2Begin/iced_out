"use client";

import { motion } from "motion/react";

import { AWARDS } from "./data";
import { EASE, Odometer, ScrollWords } from "./motion";

/**
 * Awards / featured in — the second grey block.
 *
 * The hairline under the heading draws in from the left (Motion — it needs a
 * transform-origin scale, not a fade), then the two tables stagger in on AOS
 * while every number rolls into place on its own reel. The rows slide sideways
 * rather than up, which reads better against their own dividers.
 */
export function Awards() {
  return (
    <section className="hv2-awards hv2-shell" id="awards">
      <ScrollWords
        as="h2"
        className="hv2-h2 hv2-awards__heading"
        offset={["start 0.88", "start 0.42"]}
        spread={2.1}
        text={AWARDS.heading}
      />

      <motion.div
        className="hv2-awards__rule"
        initial={{ scaleX: 0 }}
        transition={{ duration: 1.1, ease: EASE }}
        viewport={{ once: true, amount: 0.8 }}
        whileInView={{ scaleX: 1 }}
      />

      <div className="hv2-awards__grid">
        {AWARDS.columns.map((column) => (
          <div key={column.label}>
            <p className="hv2-eyebrow hv2-awards__label" data-aos="hv2-rise">
              {column.label}
            </p>

            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {column.rows.map((row, i) => (
                <li
                  className="hv2-awards__row hv2-body"
                  data-aos="hv2-slide"
                  data-aos-delay={i * 70}
                  key={row.name}
                >
                  <span>{row.name}</span>
                  <Odometer pad={"pad" in row ? row.pad : 0} value={row.value} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
