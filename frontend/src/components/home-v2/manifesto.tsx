"use client";

import { MANIFESTO } from "./data";
import { ScrollWords } from "./motion";

/**
 * The statement panel: a full-height field with the run of years pinned to
 * either gutter on the vertical midline, and the sentence inking in word by
 * word as it crosses the middle of the viewport.
 *
 * The rails are AOS (one-shot, nothing scroll-linked about them); the
 * statement is Motion, because its colour is scrubbed against scroll position
 * rather than triggered once.
 */
export function Manifesto() {
  return (
    <section className="hv2-manifesto hv2-shell">
      <span
        className="hv2-manifesto__rail hv2-manifesto__rail--from"
        data-aos="hv2-rise"
      >
        {MANIFESTO.from}
      </span>

      <ScrollWords
        className="hv2-manifesto__text"
        offset={["start 0.82", "center 0.42"]}
        spread={2.4}
        text={MANIFESTO.statement}
      />

      <span
        className="hv2-manifesto__rail hv2-manifesto__rail--to"
        data-aos="hv2-rise"
        data-aos-delay={100}
      >
        {MANIFESTO.to}
      </span>
    </section>
  );
}
