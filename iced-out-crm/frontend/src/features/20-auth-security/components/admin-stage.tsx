"use client";

import { Command } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** The house curve, the same one every animated surface in this shop uses. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * How many slices the campaign frame opens in.
 *
 * Twelve. Fewer reads as a blind being pulled and you can count the slats;
 * many more and the whole thing resolves before the eye registers that it was
 * ever in pieces.
 */
const BANDS = 12;

/**
 * Load choreography, shared by every screen outside the wall.
 *
 * Read in the order a person takes the screen: the seam is struck so the two
 * halves exist, the house introduces itself, the pitch is made, and the form —
 * the thing they actually came for — lands under their hands last but soon
 * enough that it never feels withheld.
 */
export const T = {
  bands: 0.05,
  sweep: 0.72,
  seam: 0.3,
  brand: 0.5,
  kicker: 0.62,
  title: 0.7,
  lede: 1.0,
  manifest: 1.08,
  env: 1.26,
  badge: 0.4,
  heading: 0.48,
  fields: 0.6,
  submit: 0.84,
  foot: 0.94,
} as const;

/**
 * The entrance every block on these screens shares — a short rise, one ease.
 *
 * A hook rather than a bare function because it has to read the reduced-motion
 * preference, and the answer has to be the same one the stage is using.
 */
export function useRise() {
  const reduce = useReducedMotion();

  return (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.25 : 0.62, delay: reduce ? 0 : delay, ease: EASE },
  });
}

export type StageRow = { key: string; value: string };

/**
 * The left half of every screen outside the wall, and the seam beside it.
 *
 * TWO EARLIER PASSES FAILED THE SAME WAY. The first was a 1040x600 card
 * floating in a black screen with a void down the middle of it. The second was
 * this split, but with a vector grid where the photograph is — which fixed the
 * emptiness and left the screen looking like every admin panel ever built.
 * Neither had a picture in it, and this is a fashion house: the one thing that
 * separates its console from a generic dashboard is the thing it sells.
 *
 * Nothing here is 3D. The bands are `clip-path`, the drift is `scale`, the
 * sweep is a gradient moving on `x`.
 *
 * It lives in its own file because sign-in is no longer the only door: account
 * recovery is two more screens, and a second copy of this frame would be 120
 * lines of motion choreography that could drift out of step with the first.
 * Only the words change between them.
 */
export function AdminStage({
  kicker,
  title,
  lede,
  manifest,
}: {
  kicker: string;
  /** One line per mask — the headline animates a line at a time. */
  title: readonly string[];
  lede: ReactNode;
  manifest: readonly StageRow[];
}) {
  const reduce = useReducedMotion();
  const rise = useRise();

  return (
    <>
      <section className="adl__stage">
        {/* The photograph arrives in horizontal bands opening from the middle
            out — the storefront's entrance for every image it draws, restated
            here because the console does not import the shop's component tree.
            Each band is a full copy of the picture and BOTH its slice and its
            wipe live in one `inset()`: sharing a single box means adjacent
            bands resolve to the same edge, where stacking cropped boxes leaves
            hairlines wherever the percentages round apart. */}
        <motion.div
          animate={reduce ? { scale: 1 } : { scale: [1, 1.07] }}
          className="adl__bands"
          initial={{ scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 38, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
          }
        >
          {Array.from({ length: BANDS }).map((_, index) => {
            const top = (index / BANDS) * 100;
            const bottom = 100 - ((index + 1) / BANDS) * 100;
            const shut = `inset(${top}% 100% ${bottom}% 0)`;
            const open = `inset(${top}% 0% ${bottom}% 0)`;
            /* centre-out, so the picture assembles from its middle */
            const order = Math.abs(index - (BANDS - 1) / 2);

            return (
              <motion.div
                animate={{ clipPath: open }}
                className="adl__band"
                initial={{ clipPath: shut }}
                key={index}
                transition={{
                  duration: reduce ? 0.3 : 0.86,
                  delay: reduce ? 0 : T.bands + order * 0.055,
                  ease: EASE,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={
                    index === 0
                      ? "Iced_out campaign, two models in a concrete underpass after dark"
                      : ""
                  }
                  decoding="async"
                  draggable={false}
                  src="/images/campaign-after-hours-v2.webp"
                />
              </motion.div>
            );
          })}
        </motion.div>

        <span aria-hidden="true" className="adl__grain" />
        <span aria-hidden="true" className="adl__wash" />

        {/* One light crosses the frame, once, after the bands have opened —
            the sort of thing a passing car does in the underpass this was
            shot in. It never repeats: an operator opens this screen forty
            times a week and a loop would be the thing they came to hate. */}
        <motion.span
          animate={{ x: reduce ? "0%" : "120%", opacity: reduce ? 0 : [0, 1, 1, 0] }}
          aria-hidden="true"
          className="adl__sweep"
          initial={{ x: "-120%", opacity: 0 }}
          transition={{ duration: reduce ? 0 : 1.5, delay: T.sweep, ease: "easeInOut" }}
        />

        <div className="adl__frame">
          <motion.div className="adl__brand" {...rise(T.brand)}>
            <span aria-hidden="true" className="adl__brandmark">
              <Command size={18} strokeWidth={2} />
            </span>
            <span>
              <b>ICED_OUT</b>
              <small>CRM</small>
            </span>
          </motion.div>

          <div className="adl__pitch">
            <motion.p className="adl__kicker" {...rise(T.kicker)}>
              {kicker}
            </motion.p>

            <h1 className="adl__title">
              {title.map((line, index) => (
                <span className="adl__line" key={line}>
                  <motion.span
                    animate={{ y: "0%", opacity: 1 }}
                    className="adl__lineInner"
                    initial={{ y: reduce ? "0%" : "108%", opacity: reduce ? 0 : 1 }}
                    transition={{
                      duration: reduce ? 0.25 : 0.8,
                      delay: reduce ? 0 : T.title + index * 0.1,
                      ease: EASE,
                    }}
                  >
                    {index === 0 ? line : <em>{line}</em>}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p className="adl__lede" {...rise(T.lede)}>
              {lede}
            </motion.p>

            <ul className="adl__manifest">
              {manifest.map((row, index) => (
                <motion.li className="adl__row" key={row.key} {...rise(T.manifest + index * 0.07)}>
                  <span className="adl__rowKey">{row.key}</span>
                  <span className="adl__rowValue">{row.value}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <motion.span className="adl__env" {...rise(T.env)}>
            <i aria-hidden="true" className="adl__dot" />
            Preview · India / Primary
          </motion.span>
        </div>
      </section>

      <motion.span
        animate={{ scaleY: 1, opacity: 1 }}
        aria-hidden="true"
        className="adl__seam"
        initial={{ scaleY: 0, opacity: 0 }}
        transition={{ duration: reduce ? 0.3 : 1.1, delay: T.seam, ease: EASE }}
      />
    </>
  );
}
