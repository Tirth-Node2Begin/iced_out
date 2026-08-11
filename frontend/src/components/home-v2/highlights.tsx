"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";

import { HIGHLIGHTS } from "./data";
import { DUR, EASE, RevealImage, ScrollWords } from "./motion";

/**
 * Studio highlights.
 *
 * The section pins while three states play out. The row holds four slots: the
 * three picture cards plus one copy panel, and the copy panel sits *directly
 * after the active card*, so the cards shuffle sideways around it:
 *
 *   active 01 → [ 01 ][copy][ 02 ][ 03 ]
 *   active 02 → [ 01 ][ 02 ][copy][ 03 ]
 *   active 03 → [ 01 ][ 02 ][ 03 ][copy]
 *
 * Reordering the array with stable keys is enough — motion's layout engine
 * FLIPs each card to its new slot, which is the slide the capture shows
 * between t=12.8s, 14.2s and 15.8s.
 */
const CARDS = HIGHLIGHTS.cards;

function Card({ card }: { card: (typeof CARDS)[number] }) {
  return (
    <div className="hv2-card__shell">
      <span className="hv2-card__index" data-aos="hv2-rise">
        {card.index}
      </span>
      <RevealImage
        alt={`${card.first} ${card.last}`}
        className="hv2-card__frame"
        src={card.src}
      />
      <h3 className="hv2-card__title">
        {card.first}
        <br />
        {card.last}
      </h3>
    </div>
  );
}

export function Highlights() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Three equal dwells across the pinned run, with a lead-in so the first card
  // is already active by the time the row settles.
  const stage = useTransform(scrollYProgress, [0.06, 0.94], [0, 2.999]);
  useMotionValueEvent(stage, "change", (v) => {
    const next = Math.max(0, Math.min(2, Math.floor(v)));
    setActive((prev) => (prev === next ? prev : next));
  });

  const copy = CARDS[active];

  // Build the row: cards in order, copy panel spliced in after the active one.
  const slots: Array<{ key: string; node: React.ReactNode }> = [];
  CARDS.forEach((card, i) => {
    slots.push({ key: card.index, node: <Card card={card} /> });
    if (i === active) {
      slots.push({
        key: "copy",
        node: (
          /* Same shell as a picture card — index line, 3/4 frame, title
             overhang padding — so the copy occupies a box identical to the
             photograph it sits beside. Only the frame's contents differ. */
          <div className="hv2-card__shell hv2-copy" data-tone={copy.index}>
            <span aria-hidden className="hv2-card__index hv2-copy__gutter">
              {copy.index}
            </span>
            <div className="hv2-copy__frame">
              <AnimatePresence mode="wait">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="hv2-copy__inner"
                  exit={{ opacity: 0, y: reduce ? 0 : -8 }}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  key={copy.index}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <div className="hv2-copy__head">
                    <span className="hv2-copy__badge">{copy.index}</span>
                    <span className="hv2-copy__label">
                      {copy.first} {copy.last}
                    </span>
                  </div>
                  <p className="hv2-copy__body">{copy.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ),
      });
    }
  });

  return (
    <section className="hv2-highlights" id="services" ref={ref}>
      <div className="hv2-highlights__pin hv2-shell">
        <div className="hv2-highlights__head">
          <span className="hv2-eyebrow" data-aos="hv2-rise">
            {HIGHLIGHTS.eyebrow}
          </span>
          <ScrollWords
            as="h2"
            className="hv2-h2"
            offset={["start 0.92", "start 0.5"]}
            spread={2.2}
            text={HIGHLIGHTS.heading.join("\n")}
          />
        </div>

        <div className="hv2-highlights__row">
          {slots.map((slot) => (
            <motion.div
              className="hv2-highlights__slot"
              key={slot.key}
              layout
              transition={{ duration: reduce ? 0 : DUR.reveal, ease: EASE }}
            >
              {slot.node}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
