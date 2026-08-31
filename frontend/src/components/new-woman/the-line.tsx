"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { EASE_OUT, Reveal, SplitHeading } from "@/components/new-home/motion-primitives";
import { LINE, LINE_COPY, type LinePanel } from "@/components/new-woman/data";

/**
 * Below this width the strip stops being scroll-driven.
 *
 * It has to agree with the `max-width: 900px` block in new-woman.css, which is
 * where the pin is released and the viewport becomes a native swipe. Two
 * numbers that disagree would leave a section that is pinned in CSS and free in
 * JS, or the other way round — either of which is a page that scrolls past a
 * frozen strip.
 */
const WIDE = "(min-width: 901px)";

function Panel({ panel, index }: { panel: LinePanel; index: number }) {
  return (
    <motion.article
      className="nw-panel"
      initial={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.75, delay: index * 0.07, ease: EASE_OUT }}
      viewport={{ once: true, amount: 0.25 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div
        className="nw-panel__frame"
        style={{ "--nw-op": panel.shot.op, "--nw-zoom": panel.shot.zoom } as CSSProperties}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={panel.shot.alt}
          className="nw-fit"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={panel.shot.src}
        />
      </div>

      <div className="nw-panel__body">
        <p aria-hidden className="nw-panel__index">
          {panel.index}
        </p>
        <h3 className="nw-panel__title">{panel.title}</h3>
        <p className="nw-panel__copy">{panel.body}</p>
        <dl className="nw-panel__spec">
          {panel.spec.map((row) => (
            <div className="nw-panel__specRow" key={row.key}>
              <dt className="nw-panel__specKey">{row.key}</dt>
              <dd className="nw-panel__specValue">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.article>
  );
}

/**
 * 02 — the line: four panels that travel sideways under a vertical scroll.
 *
 * The one section on either department page that moves across rather than
 * down. It is a *pinned* strip, not a carousel: there is nothing to press, the
 * page's own scroll is the only input, and the section is exactly as tall as
 * the strip is wide — so the travel finishes at the moment the pin releases and
 * the strip never sits still under a scrolling page.
 *
 * THE DISTANCE IS MEASURED, not guessed. The panels are sized in `vw`, so a
 * hardcoded percentage would over-travel on a narrow window (the last panel
 * pulling off the left edge) and under-travel on a wide one (a gap of dead
 * scroll after the last panel has landed). Measuring means the last panel comes
 * to rest against the right gutter at every width.
 *
 * Below 900px none of this applies: the pin is released in CSS, the distance is
 * held at zero here, and the strip is a native horizontal swipe with snap —
 * which is what a touch device wanted in the first place.
 */
export function TheLine() {
  const ref = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  /** How far the track has to travel for its last panel to land, in pixels. */
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const wide = window.matchMedia(WIDE);

    const measure = () => {
      const strip = track.current;
      const frame = viewport.current;
      if (!strip || !frame) return;
      /* Reduced motion keeps the strip still, so it must not be given a
         section three viewports tall to sit still inside. */
      if (!wide.matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDistance(0);
        return;
      }
      setDistance(Math.max(0, strip.scrollWidth - frame.clientWidth));
    };

    measure();

    /* Both boxes are observed: the track's width follows the panels' `vw`
       sizing and the viewport's follows the window, and a scrollbar appearing
       changes one without changing the other. */
    const observer = new ResizeObserver(measure);
    if (track.current) observer.observe(track.current);
    if (viewport.current) observer.observe(viewport.current);
    wide.addEventListener("change", measure);

    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [reduce]);

  const { scrollYProgress } = useScroll({
    target: ref,
    /* start..start to end..end: 0 is the frame arriving at the top of the
       viewport, 1 is the section's last pixel reaching the bottom of it —
       which is precisely the window during which the pin holds. */
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section
      className="nw-line"
      /* Nothing is driving the track: it is a phone, or the visitor asked for
         less motion, or the strip has not been measured yet. The stylesheet
         reads this to hand the row back to the browser as a native swipe —
         without it, a reader who cannot have the pin also cannot reach the last
         two panels, because the viewport still clips them. */
      data-still={distance > 0 ? undefined : ""}
      id="nw-line"
      ref={ref}
      /* One viewport for the pin plus exactly the travel — so the section is
         never taller than the movement it contains. Zero distance leaves it at
         its natural height, which is what the small-screen layout wants. */
      style={distance > 0 ? { height: `calc(100svh + ${distance}px)` } : undefined}
    >
      <div className="nw-line__pin">
        <div className="nh-wrap">
          <div className="nw-line__head">
            <div>
              <Reveal>
                <p className="nw-kicker">{LINE_COPY.eyebrow}</p>
              </Reveal>
              <SplitHeading className="nw-line__title" segments={LINE_COPY.heading} />
            </div>

            <Reveal delay={0.12}>
              <p className="nw-line__hint">
                {LINE_COPY.hint}
                <span aria-hidden className="nw-line__hintBar">
                  {/* the same value that drives the track, drawn as a rule —
                      the only thing telling a reader how much strip is left */}
                  <motion.span
                    className="nw-line__hintFill"
                    style={{ scaleX: progress }}
                  />
                </span>
              </p>
            </Reveal>
          </div>
        </div>

        <div className="nw-line__viewport" ref={viewport}>
          <motion.div
            className="nw-line__track"
            ref={track}
            style={distance > 0 ? { x } : undefined}
          >
            {LINE.map((panel, index) => (
              <Panel index={index} key={panel.key} panel={panel} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
