"use client";

import { ArrowRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { PointerEvent, ReactNode } from "react";

import { toneVars, type Tone } from "@/components/shell/admin-ui";

/**
 * The overview register.
 *
 * A frosted glyph chip, a tracked label, a number in a fixed line box, and a
 * movement line — the rich stat-card anatomy, translated onto the console's
 * dark surface. Three rules hold it together:
 *
 *   1. Colour lands on the GLYPH and the delta, never on the chip fill or the
 *      card background. A row of six cards is one surface.
 *   2. The number sits in a fixed 40px line box, so a currency value (which
 *      renders a step smaller) leaves the label at the same height as a count
 *      and the row does not read ragged.
 *   3. The cursor glow is written straight onto the element as `--spot-x` /
 *      `--spot-y`. No React state, so hovering never re-renders the row.
 */

export type Stat = {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Movement against the previous period. */
  delta?: { dir: "up" | "down"; value: string };
  /** A destination — renders the card as a link with a chevron. */
  href?: string;
  /** A filter — renders the card as a button with an on/off tag. */
  onSelect?: () => void;
  active?: boolean;
  tag?: string;
};

/** Writes the pointer position onto the card for the CSS glow to read. */
function track(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
}

function Body({ label, value, note, icon: Icon, delta, href, tag, active }: Stat) {
  /* A long value steps down rather than wrapping — the fixed line box is what
     keeps a row of mixed counts and currency aligned. */
  const long = value.replace(/[^\dA-Za-z]/g, "").length > 7;

  return (
    <>
      <div className="aui-stat__top">
        {Icon && (
          <span className="aui-stat__glyph">
            <Icon aria-hidden size={19} strokeWidth={1.6} />
          </span>
        )}
        {href && <ArrowRight aria-hidden className="aui-stat__go" size={16} strokeWidth={1.7} />}
        {tag && (
          <span className="aui-stat__tag">
            {active ? "● On" : tag}
          </span>
        )}
      </div>

      <div className="aui-stat__foot">
        <p className="aui-stat__label">{label}</p>
        <p className={`aui-stat__value${long ? " aui-stat__value--sm" : ""}`}>{value}</p>
        {(note || delta) && (
          <p className="aui-stat__note">
            {delta && (
              <span className="aui-stat__delta" data-dir={delta.dir}>
                {delta.dir === "up" ? (
                  <TrendingUp aria-hidden size={13} strokeWidth={2} />
                ) : (
                  <TrendingDown aria-hidden size={13} strokeWidth={2} />
                )}
                {delta.value}
              </span>
            )}
            {note}
          </p>
        )}
      </div>
    </>
  );
}

export function StatCard(stat: Stat) {
  const { tone = "ink", href, onSelect, active } = stat;
  const className = `aui-stat${href || onSelect ? " aui-stat--action" : ""}${
    active ? " aui-stat--on" : ""
  }`;

  if (href) {
    return (
      <Link className={className} href={href} onPointerMove={track} style={toneVars(tone)}>
        <Body {...stat} />
      </Link>
    );
  }

  if (onSelect) {
    return (
      <button
        aria-pressed={active ? "true" : "false"}
        className={className}
        onClick={onSelect}
        onPointerMove={track}
        style={toneVars(tone)}
        type="button"
      >
        <Body {...stat} />
      </button>
    );
  }

  /* A static card is still a <div> rather than a disabled button: disabled
     controls do not emit pointermove, and the glow would die with them. */
  return (
    <div className={className} onPointerMove={track} style={toneVars(tone)}>
      <Body {...stat} />
    </div>
  );
}

export function StatGrid({ stats, wide }: { stats: Stat[]; wide?: boolean }) {
  if (!stats.length) return null;
  return (
    <div className={`aui-stats${wide ? " aui-stats--wide" : ""}`}>
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

/**
 * The one wide card above the row of six: the thing the page is actually
 * about. A headline figure on the left, and either a sparkline or a short
 * list of supporting rows on the right.
 */
export function Spotlight({
  kicker,
  figure,
  caption,
  spark,
  rows,
  side,
}: {
  kicker: string;
  figure: string;
  caption: string;
  /** Bar heights as percentages, oldest first. */
  spark?: number[];
  rows?: Array<{ label: string; value: string }>;
  side?: ReactNode;
}) {
  return (
    <div className="aui-spotlight">
      <div className="aui-spotlight__lead">
        <p className="aui-spotlight__kicker">
          <i aria-hidden className="aui-dot" />
          {kicker}
        </p>
        <p className="aui-spotlight__figure">{figure}</p>
        <p className="aui-spotlight__caption">{caption}</p>
      </div>

      <div className="aui-spotlight__side">
        {spark && (
          <div aria-hidden className="aui-spark">
            {spark.map((height, index) => (
              <i key={`${height}-${index}`} style={{ height: `${Math.max(4, height)}%` }} />
            ))}
          </div>
        )}
        {rows && (
          <div className="aui-spotlight__rows">
            {rows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        )}
        {side}
      </div>
    </div>
  );
}
