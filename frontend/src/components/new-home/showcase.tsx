"use client";

import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { SHOWCASE, type ShowcaseSlide } from "@/components/new-home/data";

const PHRASE = "Fresh fits for your next workout";
const COUNT = SHOWCASE.length;

function MarqueeRow({
  x,
  placement,
}: {
  x: MotionValue<string>;
  placement: "top" | "bottom";
}) {
  return (
    <motion.div
      aria-hidden
      className={`nh-showcase__marquee nh-showcase__marquee--${placement}`}
      style={{ x }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i}>{PHRASE}</span>
      ))}
    </motion.div>
  );
}

/**
 * One pinned slide.
 *
 * The marquee runs on the section background only. The card is opaque, so the
 * type passes behind it and is simply hidden for the width of the card — no
 * lettering reads over the shot.
 */
function Slide({
  index,
  progress,
  slide,
}: {
  index: number;
  progress: MotionValue<number>;
  slide: ShowcaseSlide;
}) {
  const band = 1 / COUNT;
  const start = index * band;
  const end = start + band;
  const feather = band * 0.3;

  const first = index === 0;
  const last = index === COUNT - 1;

  // Every keyframe list has to start at 0, end at 1 and ascend strictly.
  // Motion hands scroll-linked transforms to the native scroll timeline, and
  // outside a declared range the animation simply stops applying — the element
  // then drifts back to its base value instead of holding the last keyframe.
  // Spanning the full range is what keeps a slide hidden once it has passed.
  const inRange = first
    ? [0, end - feather * 0.35, end + feather, 1]
    : last
      ? [0, start - feather, start + feather * 0.35, 1]
      : [
          0,
          start - feather,
          start + feather * 0.35,
          end - feather * 0.35,
          end + feather,
          1,
        ];

  const opacity = useTransform(
    progress,
    inRange,
    first ? [1, 1, 0, 0] : last ? [0, 0, 1, 1] : [0, 0, 1, 1, 0, 0],
  );

  const shotScale = useTransform(
    progress,
    inRange,
    first
      ? [1, 1, 0.96, 0.96]
      : last
        ? [1.09, 1.09, 1, 1]
        : [1.09, 1.09, 1, 1, 0.96, 0.96],
  );

  return (
    <motion.div className="nh-card3d nh-card3d--stacked" style={{ opacity }}>
      <div className="nh-card3d__plate" />

      <motion.div className="nh-card3d__shot" style={{ scale: shotScale }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={slide.left.replace(/\n/g, " ")} src={slide.image} />
      </motion.div>

      {slide.intro ? (
        <div className="nh-card3d__intro">
          <p className="nh-eyebrow nh-card3d__kicker">{slide.kicker}</p>
          <p className="nh-display nh-card3d__introTitle">
            With the latest in <span className="nh-light">workout wear</span>
          </p>
        </div>
      ) : null}

      <p className="nh-card3d__label nh-card3d__label--tl">
        {slide.left.split("\n").map((l) => (
          <span className="block" key={l}>
            {l}
          </span>
        ))}
      </p>
      <p className="nh-card3d__label nh-card3d__label--tr">
        {slide.right.split("\n").map((l) => (
          <span className="block" key={l}>
            {l}
          </span>
        ))}
      </p>
      <p className="nh-card3d__label nh-card3d__label--bl">
        {slide.season.split("\n").map((l) => (
          <span className="block" key={l}>
            {l}
          </span>
        ))}
      </p>
      <p className="nh-card3d__label nh-card3d__label--br">
        <span className="nh-card3d__dot" />
        <span>
          {slide.extra.split("\n").map((l) => (
            <span className="block" key={l}>
              {l}
            </span>
          ))}
        </span>
      </p>
    </motion.div>
  );
}

/**
 * 04 — the pinned showcase. One viewport stays pinned for the length of the
 * slide stack; scroll drives both the card swap and two counter-running bands
 * of oversized type.
 */
export function Showcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const topX = useTransform(scrollYProgress, [0, 1], ["4%", "-44%"]);
  const bottomX = useTransform(scrollYProgress, [0, 1], ["-44%", "4%"]);

  return (
    <section
      className="nh-showcase"
      id="showcase"
      ref={ref}
      style={{ height: `${COUNT * 100}svh` }}
    >
      <div className="nh-showcase__sticky">
        <MarqueeRow placement="top" x={topX} />
        <MarqueeRow placement="bottom" x={bottomX} />

        <motion.div
          className="nh-showcase__stack"
          initial={{ opacity: 0, y: 44 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
          viewport={{ once: true, amount: 0.2 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {SHOWCASE.map((slide, i) => (
            <Slide
              index={i}
              key={slide.id}
              progress={scrollYProgress}
              slide={slide}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
