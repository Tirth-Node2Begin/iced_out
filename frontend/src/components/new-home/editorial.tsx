"use client";

import {
  motion,
  useInView,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, type CSSProperties } from "react";

import {
  BlindsImage,
  EASE_OUT,
  Reveal,
} from "@/components/new-home/motion-primitives";
import { SHOTS } from "@/components/new-home/data";

const FRAMES = [
  {
    key: "a",
    src: SHOTS.still,
    alt: "Training short, detail",
    slices: 9,
    delay: 0.05,
    direction: "down" as const,
  },
  {
    key: "b",
    src: SHOTS.campaign,
    alt: "Winter shell, studio",
    slices: 13,
    delay: 0.12,
    direction: "center" as const,
  },
  {
    key: "c",
    src: SHOTS.drop,
    alt: "Layering system, detail",
    slices: 9,
    delay: 0.2,
    direction: "up" as const,
  },
];

/**
 * The giant word, drawn twice.
 *
 * In the reference the letters run *over* the photographs, not behind them,
 * and they change colour as they cross: a shade darker than the page on the
 * background, near-white where they pass over a dark frame. One element cannot
 * do both, so the word is rendered once on the section and once inside each
 * frame — the frame's own `overflow: hidden` clips the second copy to exactly
 * the picture it is crossing.
 *
 * The two copies stay in register because the inner wrapper reconstructs the
 * section box (via the negative offsets in the stylesheet) and the type is
 * sized in `vw`, so it resolves identically in both.
 */
function GhostWord({
  tone,
  word,
  x,
  y,
  inView,
}: {
  tone: "page" | "over";
  word: string;
  x: MotionValue<string>;
  y: MotionValue<number>;
  inView: boolean;
}) {
  return (
    <div aria-hidden className="nh-editorial__ghostWrap">
      {/* the drift lives on the outer element and the entrance on the inner
          one, so the scroll transform and the reveal never overwrite each
          other's `transform` */}
      <motion.div style={{ x, y }}>
        <motion.p
          animate={inView ? "show" : "hidden"}
          className={`nh-editorial__ghost nh-editorial__ghost--${tone}`}
          initial="hidden"
          variants={{
            hidden: { opacity: 0, y: "34%", scaleX: 1.08 },
            show: {
              opacity: 1,
              y: "0%",
              scaleX: 1,
              transition: { duration: 1.15, ease: EASE_OUT },
            },
          }}
          // the stylesheet sizes the line down from its length — both copies
          // read the same number, so they stay in register
          style={{ "--nh-ghost-chars": word.length } as CSSProperties}
        >
          {word}
        </motion.p>
      </motion.div>
    </div>
  );
}

/**
 * 02 — the editorial. Three offset frames blind-reveal on a stagger while the
 * oversized word drifts against the scroll behind and across them.
 *
 * `word` is what the giant type spells — "Workout" on the home page, the
 * department name on /new-man and /new-woman — and `notes` is the pair of
 * paragraphs pinned top-right and bottom-left (see `DEPARTMENTS` in data.ts).
 */
export function Editorial({
  word = "Workout",
  notes = [
    "Stay warm, stay fit. Our winter workout wear blends insulation with flexibility to keep you going in the toughest conditions",
    "Performance-driven gear for men—built for summer heat and winter cold.",
  ],
}: {
  word?: string;
  notes?: [string, string];
} = {}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const ghostX = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const ghostY = useTransform(scrollYProgress, [0, 1], [70, -70]);

  // one shared trigger for every copy of the word — if each copy watched its
  // own frame they would reveal at different moments and drift out of register
  const ghostInView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <section className="nh-section" id="workout" ref={ref}>
      <div className="nh-wrap">
        <div className="nh-editorial">
          <GhostWord
            inView={ghostInView}
            tone="page"
            word={word}
            x={ghostX}
            y={ghostY}
          />

          {FRAMES.map((frame) => (
            <div
              className={`nh-editorial__media nh-editorial__${frame.key}`}
              key={frame.key}
            >
              <BlindsImage
                alt={frame.alt}
                className="h-full"
                delay={frame.delay}
                direction={frame.direction}
                slices={frame.slices}
                src={frame.src}
              />
              <div aria-hidden className="nh-editorial__ghostClip">
                <GhostWord
                  inView={ghostInView}
                  tone="over"
                  word={word}
                  x={ghostX}
                  y={ghostY}
                />
              </div>
            </div>
          ))}

          <Reveal className="nh-editorial__note nh-editorial__note--tr" delay={0.25}>
            <p className="nh-body">{notes[0]}</p>
          </Reveal>

          <Reveal className="nh-editorial__note nh-editorial__note--bl" delay={0.32}>
            <p className="nh-body">{notes[1]}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
