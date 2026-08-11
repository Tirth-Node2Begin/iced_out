"use client";

/* ==========================================================================
   nh-components-plus.tsx — ADDITIVE components for /new-home
   --------------------------------------------------------------------------
   Fifteen components that fill gaps the page doesn't cover yet (product
   detail, FAQ, cart, wayfinding, closing CTA) without restyling anything it
   already has. Every one is built from tokens that already exist and shapes
   that already exist — a new arrangement of the same vocabulary, not a new
   vocabulary.

   Requires: nh-plus.css, nh-motion-plus.tsx, and the tokens on `.nh-root`.
   ========================================================================== */

import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import { scrollToHash } from "@/lib/in-page-scroll";
import {
  Counter,
  EASE_OUT,
  LineMask,
  Magnetic,
  Scramble,
  Sheen,
  Tilt,
  useSectionProgress,
} from "./nh-motion-plus";

export {
  Counter,
  EASE_OUT,
  LineMask,
  Magnetic,
  Scramble,
  Sheen,
  Tilt,
  useSectionProgress,
};

const cn = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

/* `motion.a` is still an anchor in the DOM, so a tile animated that way paid a
   full document load for every press. Wrapping the Link itself keeps the
   entrance and hands the navigation back to the router. Created once at module
   scope — rebuilding it per render remounts the tile on every paint. */
const MotionLink = motion.create(Link);

/* ==========================================================================
   1. Rail — page progress + where you are
   ========================================================================== */

export function Rail({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  const ids = sections.map((s) => s.id);
  const { scrollYProgress, active } = useSectionProgress(ids);

  return (
    <>
      <div className="nhx-rail">
        <motion.div className="nhx-rail__fill" style={{ scaleX: scrollYProgress }} />
      </div>
      <div className="nhx-rail__index" aria-hidden>
        <b>{String(active + 1).padStart(2, "0")}</b>
        <Scramble key={active} text={sections[active]?.label ?? ""} amount={0} />
        <b>/ {String(sections.length).padStart(2, "0")}</b>
      </div>
    </>
  );
}

/* ==========================================================================
   2. Ticker — the announcement strip
   ========================================================================== */

export function Ticker({ items, className }: { items: string[]; className?: string }) {
  const group = (key: string) => (
    <div className="nhx-ticker__group" key={key} aria-hidden={key === "b"}>
      {items.map((item, i) => (
        <span className="nhx-ticker__item" key={`${key}-${i}`}>
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className={cn("nhx-ticker", className)}>
      <div className="nhx-ticker__track">
        {group("a")}
        {group("b")}
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Shelf — the bar that arrives after the hero
   ========================================================================== */

export function Shelf({
  links,
  logo = "Iced_out",
}: {
  links: { href: string; label: string; id?: string }[];
  logo?: string;
}) {
  const { scrollY } = useScroll();
  const [shown, setShown] = useState(false);
  const reduce = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (y) => {
    setShown(y > window.innerHeight * 0.92);
  });

  return (
    <motion.div
      className="nhx-shelf"
      initial={{ y: "-100%" }}
      animate={{ y: shown ? "0%" : "-100%" }}
      transition={{ duration: reduce ? 0.15 : 0.55, ease: EASE_OUT }}
    >
      <span className="nhx-shelf__logo">{logo}</span>
      {/* The bar's destinations are section ids on the page it floats over as
          readily as they are routes, and the two cannot be the same element: a
          hash only moves the viewport, while a route has to go through the
          router or the press costs a full document load. */}
      <nav className="nhx-shelf__links">
        {links.map((l) =>
          l.href.startsWith("#") ? (
            <button
              className="nhx-shelf__link"
              key={l.href}
              onClick={() => scrollToHash(l.href)}
              type="button"
            >
              {l.label}
            </button>
          ) : (
            <Link className="nhx-shelf__link" href={l.href} key={l.href}>
              {l.label}
            </Link>
          ),
        )}
      </nav>
    </motion.div>
  );
}

/* ==========================================================================
   4. Divider — a rule that opens from the label outwards
   ========================================================================== */

export function Divider({ label, className }: { label: string; className?: string }) {
  const reduce = useReducedMotion();
  const rule = {
    hidden: { scaleX: 0 },
    show: { scaleX: 1, transition: { duration: reduce ? 0.2 : 0.9, ease: EASE_OUT } },
  };

  return (
    <motion.div
      className={cn("nhx-divider", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
    >
      <motion.span className="nhx-divider__rule nhx-divider__rule--l" variants={rule} />
      <span className="nhx-divider__label">
        <Scramble text={label} />
      </span>
      <motion.span className="nhx-divider__rule nhx-divider__rule--r" variants={rule} />
    </motion.div>
  );
}

/* ==========================================================================
   5. Spec — the key/value sheet
   ========================================================================== */

export function Spec({
  rows,
  className,
}: {
  rows: { key: string; value: string }[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <dl className={cn("nhx-spec", className)}>
      {rows.map((row, i) => (
        <motion.div
          className="nhx-spec__row"
          key={row.key}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.62, delay: i * 0.06, ease: EASE_OUT }}
        >
          <dt className="nhx-spec__key">{row.key}</dt>
          <dd className="nhx-spec__val">{row.value}</dd>
          <motion.span
            className="nhx-spec__rule"
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.72, delay: i * 0.06 + 0.1, ease: EASE_OUT }}
          />
        </motion.div>
      ))}
    </dl>
  );
}

/* ==========================================================================
   6. Accordion — size guide / FAQ
   ========================================================================== */

export function Accordion({
  items,
  className,
  allowMultiple = false,
}: {
  items: { q: string; a: string }[];
  className?: string;
  allowMultiple?: boolean;
}) {
  const [open, setOpen] = useState<number[]>([]);

  const toggle = (i: number) =>
    setOpen((prev) =>
      prev.includes(i)
        ? prev.filter((n) => n !== i)
        : allowMultiple
        ? [...prev, i]
        : [i]
    );

  return (
    <div className={cn("nhx-acc", className)}>
      {items.map((item, i) => {
        const isOpen = open.includes(i);
        return (
          <div className="nhx-acc__item" key={item.q} data-open={isOpen}>
            <button
              className="nhx-acc__head"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              aria-controls={`nhx-acc-${i}`}
            >
              <span className="nhx-acc__num">{String(i + 1).padStart(2, "0")}</span>
              <span>{item.q}</span>
              <span className="nhx-acc__sign" aria-hidden />
            </button>
            <div className="nhx-acc__body" id={`nhx-acc-${i}`} role="region">
              <div className="nhx-acc__bodyInner">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   7. Choice — sizes and colourways
   ========================================================================== */

export function SizeChoice({
  sizes,
  value,
  onChange,
}: {
  sizes: { label: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="nhx-choice" role="group" aria-label="Size">
      {sizes.map((s) => (
        <Magnetic key={s.label} strength={0.18} max={5}>
          <button
            className="nhx-size"
            aria-pressed={value === s.label}
            disabled={s.disabled}
            onClick={() => onChange(s.label)}
          >
            {s.label}
          </button>
        </Magnetic>
      ))}
    </div>
  );
}

export function ColorChoice({
  colors,
  value,
  onChange,
}: {
  colors: { id: string; label: string; modifier: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="nhx-choice" role="group" aria-label="Colour">
      {colors.map((c) => (
        <button
          key={c.id}
          className={cn("nhx-swatch", `nhx-swatch--${c.modifier}`)}
          aria-pressed={value === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

/* ==========================================================================
   8. Field — the newsletter input
   ========================================================================== */

export function Field({
  placeholder = "Email address",
  label = "Join the drop list",
  onSubmit,
}: {
  placeholder?: string;
  label?: string;
  onSubmit?: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div>
      <span className="nhx-spec__key" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </span>
      <div className="nhx-field">
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.(value)}
          aria-label={label}
        />
        <button
          className="nhx-field__go"
          onClick={() => onSubmit?.(value)}
          aria-label="Join the drop list"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1 6h9M6.5 2.5 10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <span className="nhx-field__line" />
      </div>
    </div>
  );
}

/* ==========================================================================
   9. Quote — the pull-quote
   ========================================================================== */

export function Quote({
  lines,
  credit,
  className,
}: {
  lines: string[];
  credit: string;
  className?: string;
}) {
  return (
    <blockquote className={cn("nhx-quote", className)}>
      <LineMask lines={lines} as="p" stagger={0.08} />
      <cite>
        <Scramble text={credit} delay={0.4} />
      </cite>
    </blockquote>
  );
}

/* ==========================================================================
   10. Stats — counters on the ghost type recipe
   ========================================================================== */

export function Stats({
  items,
  className,
}: {
  items: { value: number; label: string; pad?: number; suffix?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("nhx-stats", className)}>
      {items.map((item, i) => (
        <motion.div
          className="nhx-stat"
          key={item.label}
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.72, delay: i * 0.08, ease: EASE_OUT }}
        >
          <span className="nhx-stat__num">
            <Counter to={item.value} pad={item.pad ?? 0} delay={i * 0.08 + 0.1} />
            {item.suffix ? <sup>{item.suffix}</sup> : null}
          </span>
          <span className="nhx-stat__label">{item.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ==========================================================================
   11. Frame — the wide lookbook tile
   ========================================================================== */

export function Frame({
  src,
  alt,
  labels,
  href = "#",
  tilt = true,
  className,
}: {
  src: string;
  alt: string;
  labels: { tl?: string; tr?: string; bl?: string; br?: string };
  href?: string;
  tilt?: boolean;
  className?: string;
}) {
  const body = (
    <Sheen className={cn("nhx-frame", className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {labels.tl && (
        <span className="nhx-frame__label nhx-frame__label--tl">
          <Scramble text={labels.tl} />
        </span>
      )}
      {labels.tr && (
        <span className="nhx-frame__label nhx-frame__label--tr">
          <Scramble text={labels.tr} delay={0.08} />
        </span>
      )}
      {labels.bl && (
        <span className="nhx-frame__label nhx-frame__label--bl">
          <Scramble text={labels.bl} delay={0.16} />
        </span>
      )}
      {labels.br && (
        <span className="nhx-frame__label nhx-frame__label--br">
          <Scramble text={labels.br} delay={0.24} />
        </span>
      )}
    </Sheen>
  );

  const wrapped = tilt ? <Tilt maxDeg={3.5}>{body}</Tilt> : body;

  return (
    <MotionLink
      href={href}
      style={{ display: "block" }}
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.78, ease: EASE_OUT }}
    >
      {wrapped}
    </MotionLink>
  );
}

/* ==========================================================================
   12. Band — the closing CTA
   ========================================================================== */

export function Band({
  ghost,
  children,
  className,
}: {
  ghost: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <div className={cn("nhx-band", className)} ref={ref}>
      <motion.span
        className="nhx-band__ghost"
        aria-hidden
        style={reduce ? undefined : { x, y }}
      >
        {ghost}
      </motion.span>
      <div className="nhx-band__inner">{children}</div>
    </div>
  );
}

/* ==========================================================================
   13. Drawer — the cart
   ========================================================================== */

export function Drawer({
  open,
  onClose,
  title = "Bag",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <>
      <motion.div
        className="nhx-scrim"
        onClick={onClose}
        animate={{ opacity: open ? 1 : 0 }}
        style={{ pointerEvents: open ? "auto" : "none" }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        aria-hidden
      />
      <motion.div
        ref={panel}
        className="nhx-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ x: "100%" }}
        animate={{ x: open ? "0%" : "100%" }}
        transition={{ duration: reduce ? 0.15 : 0.62, ease: EASE_OUT }}
      >
        <div className="nhx-drawer__head">
          <span className="nhx-drawer__title">{title}</span>
          <button className="nhx-field__go" onClick={onClose} aria-label="Close bag">
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
        <div className="nhx-drawer__body">{children}</div>
        {footer ? <div className="nhx-drawer__foot">{footer}</div> : null}
      </motion.div>
    </>
  );
}

export function LineItem({
  src,
  name,
  meta,
  price,
  index = 0,
}: {
  src: string;
  name: string;
  meta: string;
  price: string;
  index?: number;
}) {
  return (
    <motion.div
      className="nhx-line-item"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.12 + index * 0.06, ease: EASE_OUT }}
    >
      <span className="nhx-line-item__thumb">
        <img src={src} alt="" />
      </span>
      <span>
        <span className="nhx-line-item__name">{name}</span>
        <span className="nhx-line-item__meta">{meta}</span>
      </span>
      <span className="nhx-line-item__price">{price}</span>
    </motion.div>
  );
}

/* ==========================================================================
   14. Badge — stock state
   ========================================================================== */

export function Badge({
  children,
  quiet = false,
}: {
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return <span className={cn("nhx-badge", quiet && "nhx-badge--quiet")}>{children}</span>;
}

/* ==========================================================================
   15. Note — the hairline-hung annotation
   ========================================================================== */

export function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div
      className="nhx-note"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.72, ease: EASE_OUT }}
    >
      <span className="nhx-note__key">
        <Scramble text={label} />
      </span>
      <p>{children}</p>
    </motion.div>
  );
}
