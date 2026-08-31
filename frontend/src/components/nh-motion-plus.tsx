"use client";

/* ==========================================================================
   nh-motion-plus.tsx — ADDITIVE motion primitives for /new-home
   --------------------------------------------------------------------------
   Extends the three primitives in §6.1 (Reveal, SplitHeading, BlindsImage)
   without touching them. Same library, same curve, same rules:

   • one ease — EASE_OUT / --nh-ease. No new curves, no springs (with one
     labelled exception in `Magnetic`, which ships a tween default).
   • every in-view trigger is `once: true`. Nothing replays. (§6.9)
   • every scroll-linked keyframe list spans 0 → 1 inclusive. (§6.5)
   • parallax and entrance transforms never share an element. (§11.6.6)
   • NEW: every primitive here is gated with `useReducedMotion()`, which
     closes the gap called out in §6.10 — for this layer only. Existing
     components are untouched.
   ========================================================================== */

import {
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  animate,
  type MotionValue,
  type Variants,
} from "motion/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

/* --- shared ------------------------------------------------------------- */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const cn = (...v: Array<string | false | null | undefined>) =>
  v.filter(Boolean).join(" ");

/* ==========================================================================
   1. LineMask — line-by-line rise out of a mask
   ========================================================================== */

export function LineMask({
  lines,
  className,
  lineClassName,
  as: Tag = "p",
  delay = 0,
  stagger = 0.07,
  once = true,
  amount = 0.4,
  style,
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
  as?: "p" | "h2" | "h3" | "div";
  delay?: number;
  stagger?: number;
  once?: boolean;
  amount?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag];

  return (
    <div ref={ref} style={style}>
      <MotionTag
        className={cn("nhx-lines", className)}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        transition={{ delayChildren: delay, staggerChildren: reduce ? 0 : stagger }}
        aria-label={lines.join(" ")}
      >
        {lines.map((line, i) => (
          <span className={cn("nhx-line", lineClassName)} key={`${line}-${i}`} aria-hidden>
            <motion.span
              className="nhx-line__inner"
              variants={{
                hidden: reduce ? { opacity: 0 } : { y: "110%", opacity: 0 },
                show: {
                  y: "0%",
                  opacity: 1,
                  transition: { duration: reduce ? 0.2 : 0.86, ease: EASE_OUT },
                },
              }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </MotionTag>
    </div>
  );
}

/* ==========================================================================
   2. Scramble — the decoding spec label
   ========================================================================== */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_:.";

export function Scramble({
  text,
  className,
  as: Tag = "span",
  delay = 0,
  speed = 45,
  lockRate = 2.2,
  once = true,
  amount = 0.6,
  style,
}: {
  text: string;
  className?: string;
  as?: "span" | "p" | "div";
  delay?: number;
  speed?: number;
  lockRate?: number;
  once?: boolean;
  amount?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduce = useReducedMotion();
  /* Only ever holds the ANIMATED frames. What reduced motion should show is
     `text` itself, and that is decided at render time below rather than pushed
     into state by the effect — a setState in an effect body is a cascading
     render, and it also got the two edge cases wrong: it never caught the OS
     setting being turned on mid-life, and it re-ran on every `text` change to
     write a value the initialiser had already put there. */
  const [out, setOut] = useState("");

  useEffect(() => {
    if (!inView || reduce) return;

    let raf = 0;
    let frame = 0;
    let last = 0;
    let started = false;
    const startAt = performance.now() + delay * 1000;
    const noise = Array.from({ length: text.length }, () => Math.random() * 6);

    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!started) {
        started = true;
        last = now;
      }
      if (now - last >= speed) {
        last = now;
        frame += 1;

        let done = true;
        let next = "";
        for (let i = 0; i < text.length; i += 1) {
          const char = text[i];
          if (char === " ") {
            next += " ";
            continue;
          }
          if (frame >= i * lockRate + noise[i]) {
            next += char;
          } else {
            done = false;
            next += CHARSET[Math.floor(Math.random() * CHARSET.length)];
          }
        }
        setOut(next);
        if (done) return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, text, delay, speed, lockRate]);

  return (
    <Tag ref={ref as never} className={cn("nhx-scramble", className)} style={style} aria-label={text}>
      {/* Reduced motion gets the finished text, never a frame of noise. The
          fallback for the un-started state is the text's own shape in spaces,
          so the line holds its width and nothing below it shifts when the
          scramble begins. */}
      <span aria-hidden>{reduce ? text : out || text.replace(/\S/g, " ")}</span>
    </Tag>
  );
}

/* ==========================================================================
   3. Counter — the number roll
   ========================================================================== */

export function Counter({
  to,
  from = 0,
  duration = 1.4,
  delay = 0,
  pad = 0,
  prefix = "",
  suffix = "",
  className,
  once = true,
  amount = 0.5,
}: {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  pad?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  once?: boolean;
  amount?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : from);
  const [shown, setShown] = useState(reduce ? to : from);

  useMotionValueEvent(value, "change", (v) => setShown(Math.round(v)));

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(value, to, { duration, delay, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, reduce, to, duration, delay, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {String(shown).padStart(pad, "0")}
      {suffix}
    </span>
  );
}

/* ==========================================================================
   4. Magnetic — pointer attraction for pills and icon buttons
   ========================================================================== */

export function Magnetic({
  children,
  strength = 0.28,
  max = 10,
  spring = false,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  max?: number;
  spring?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const softX = useSpring(rawX, { stiffness: 220, damping: 26, mass: 0.6 });
  const softY = useSpring(rawY, { stiffness: 220, damping: 26, mass: 0.6 });
  const x = spring ? softX : rawX;
  const y = spring ? softY : rawY;

  const clamp = (n: number) => Math.max(-max, Math.min(max, n));

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (reduce) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      rawX.set(clamp((e.clientX - (r.left + r.width / 2)) * strength));
      rawY.set(clamp((e.clientY - (r.top + r.height / 2)) * strength));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduce, strength, max]
  );

  const onLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.span
      ref={ref}
      className={cn("nhx-magnetic", className)}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      transition={spring ? undefined : { duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </motion.span>
  );
}

/* ==========================================================================
   5. Tilt — pointer tilt with a light source that follows
   ========================================================================== */

export function Tilt({
  children,
  maxDeg = 5.5,
  perspective = 900,
  className,
}: {
  children: React.ReactNode;
  maxDeg?: number;
  perspective?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateY = useTransform(px, [0, 1], [-maxDeg, maxDeg]);
  const rotateX = useTransform(py, [0, 1], [maxDeg, -maxDeg]);

  const onMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };

  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div style={{ perspective }} className={className}>
      <motion.div
        ref={ref}
        className="nhx-tilt"
        style={{ rotateX, rotateY }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   6. Sheen — one specular pass on entry
   ========================================================================== */

export function Sheen({
  children,
  className,
  delay = 0,
  onHover = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onHover?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();

  const run = useCallback(() => {
    const el = ref.current;
    if (!el || reduce) return;
    el.removeAttribute("data-sheen");
    // force a reflow so the animation can be retriggered
    void el.offsetWidth;
    el.setAttribute("data-sheen", "run");
  }, [reduce]);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(run, delay * 1000);
    return () => clearTimeout(t);
  }, [inView, delay, run]);

  return (
    <div
      ref={ref}
      className={cn("nhx-sheen", className)}
      onPointerEnter={onHover ? run : undefined}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   7. WipeImage — the single-pass alternative to BlindsImage
   ========================================================================== */

export function WipeImage({
  src,
  alt,
  className,
  imgClassName,
  direction = "left",
  delay = 0,
  duration = 0.9,
  priority = false,
  once = true,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  direction?: "left" | "right" | "up";
  delay?: number;
  duration?: number;
  priority?: boolean;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.2 });
  const reduce = useReducedMotion();

  const shut =
    direction === "left"
      ? "inset(0 100% 0 0)"
      : direction === "right"
      ? "inset(0 0 0 100%)"
      : "inset(100% 0 0 0)";
  const open = "inset(0% 0% 0% 0%)";

  return (
    <div className={cn("nhx-wipe", className)} ref={ref}>
      <motion.div
        className="nhx-wipe__media"
        initial={reduce ? { opacity: 0 } : { clipPath: shut }}
        animate={inView ? (reduce ? { opacity: 1 } : { clipPath: open }) : undefined}
        transition={{ duration: reduce ? 0.2 : duration, delay, ease: EASE_OUT }}
      >
        <motion.img
          src={src}
          alt={alt}
          className={imgClassName}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          initial={reduce ? false : { scale: 1.06 }}
          animate={inView && !reduce ? { scale: 1 } : undefined}
          transition={{ duration: duration + 0.25, delay, ease: EASE_OUT }}
        />
      </motion.div>

      {!reduce && direction !== "up" && (
        <motion.span
          className="nhx-wipe__edge"
          aria-hidden
          initial={{ x: direction === "left" ? "0%" : "100%", opacity: 0 }}
          animate={
            inView
              ? {
                  x: direction === "left" ? "100%" : "0%",
                  opacity: [0, 1, 1, 0],
                }
              : undefined
          }
          style={{ left: direction === "left" ? 0 : "auto", right: direction === "right" ? 0 : "auto" }}
          transition={{
            duration,
            delay,
            ease: EASE_OUT,
            opacity: { times: [0, 0.12, 0.7, 1], duration, delay, ease: EASE_OUT },
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   8. useCascade — the diagonal grid delay, made breakpoint-aware
   ========================================================================== */

export function useCascade(columns: number[] = [4, 3, 2, 1]) {
  const [cols, setCols] = useState(columns[0]);

  useEffect(() => {
    const queries = [
      { mq: window.matchMedia("(max-width: 520px)"), cols: columns[3] },
      { mq: window.matchMedia("(max-width: 860px)"), cols: columns[2] },
      { mq: window.matchMedia("(max-width: 1100px)"), cols: columns[1] },
    ];
    const read = () => {
      const hit = queries.find((q) => q.mq.matches);
      setCols(hit ? hit.cols : columns[0]);
    };
    read();
    queries.forEach((q) => q.mq.addEventListener("change", read));
    return () => queries.forEach((q) => q.mq.removeEventListener("change", read));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useCallback(
    (index: number) => (index % cols) * 0.09 + Math.floor(index / cols) * 0.06,
    [cols]
  );
}

/* ==========================================================================
   9. useSectionProgress — page rail + section index
   ========================================================================== */

export function useSectionProgress(ids: string[]) {
  const { scrollYProgress } = useScroll();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = ids.indexOf(entry.target.id);
            if (i >= 0) setActive(i);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return { scrollYProgress, active };
}

/* ==========================================================================
   10. StickyReveal — pinned two-up editorial
   ========================================================================== */

export function useStickyIndex(count: number, ref: React.RefObject<HTMLElement>) {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const [index, setIndex] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(count - 1, Math.max(0, Math.floor(p * count)));
    setIndex(next);
  });

  return { index, scrollYProgress };
}

/* ==========================================================================
   11. Curtain — the route transition
   ========================================================================== */

const curtainVariants: Variants = {
  hidden: { y: "100%" },
  cover: { y: "0%", transition: { duration: 0.55, ease: EASE_OUT } },
  clear: { y: "-100%", transition: { duration: 0.55, delay: 0.06, ease: EASE_OUT } },
};

export function Curtain({ state }: { state: "hidden" | "cover" | "clear" }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      variants={curtainVariants}
      initial="hidden"
      animate={state}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "var(--nh-surface-3, #0a0b0c)",
        pointerEvents: "none",
      }}
    />
  );
}

/* ==========================================================================
   12. Parallax — the safe wrapper
   ========================================================================== */

export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

export type { MotionValue };
