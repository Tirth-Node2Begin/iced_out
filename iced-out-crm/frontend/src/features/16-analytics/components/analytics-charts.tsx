"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { toneVars, type Tone } from "@/components/shell/admin-ui";

/**
 * The console's charts, drawn by hand.
 *
 * Three forms and no more: a trend line for a value over time, columns for a
 * count per day, and labelled horizontal bars for a breakdown. They share one
 * discipline — thin marks, hairline solid gridlines, colour on the mark and
 * never on the text — and every one of them can be read three ways: off the
 * marks, off the hover read-out, and off the table behind the "view as table"
 * fold, so nothing is gated behind a pointer.
 *
 * The lines and washes live in an SVG stretched with `preserveAspectRatio:
 * none`; everything with a fixed size — dots, labels, the crosshair, the
 * read-out — is HTML positioned over it, so nothing distorts when the panel
 * resizes.
 */

const TONE_HEX: Record<Tone, string> = {
  ink: "#f1f3f3",
  mint: "#6fdba4",
  amber: "#e8b765",
  rose: "#ef7a80",
  sky: "#79b8e8",
  violet: "#a892e8",
};

/** The de-emphasis grey a comparison series wears — context, not subject. */
const COMPARE = "rgba(241, 243, 243, 0.30)";

/** Rounds a scale ceiling up to a clean number so ticks read as ticks. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}

/** The index under the pointer, snapped to the nearest data position. */
function nearestIndex(event: PointerEvent<HTMLElement>, count: number, bands: boolean) {
  const box = event.currentTarget.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  const index = bands
    ? Math.floor(fraction * count)
    : Math.round(fraction * (count - 1));
  return Math.max(0, Math.min(count - 1, index));
}

/** Arrow keys walk the same positions the pointer hovers. */
function stepIndex(event: KeyboardEvent<HTMLElement>, active: number | null, count: number) {
  if (event.key === "ArrowRight") return Math.min(count - 1, (active ?? -1) + 1);
  if (event.key === "ArrowLeft") return Math.max(0, (active ?? count) - 1);
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  if (event.key === "Escape") return null;
  return active;
}

/* ------------------------------------------------------------- read-out */

type ReadoutRow = { label: string; value: string; swatch?: string };

/**
 * The hover read-out. Values lead and labels follow — the reader already knows
 * which chart they are on; the number is what they came for.
 */
function Readout({ at, title, rows }: { at: number; title: string; rows: ReadoutRow[] }) {
  return (
    <div
      className="aui-viz__readout"
      data-side={at > 55 ? "left" : "right"}
      style={{ left: `${at}%` }}
    >
      <strong>{title}</strong>
      {rows.map((row) => (
        <p key={row.label}>
          {row.swatch && <i style={{ background: row.swatch }} />}
          <b>{row.value}</b>
          <span>{row.label}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ table twin */

/**
 * Every chart's WCAG-clean twin. Folded, not hidden — the values are real
 * rows, reachable without a pointer and readable by anything that reads HTML.
 */
function TableTwin({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <details className="aui-viz__fold">
      <summary>View as table</summary>
      <div className="aui-viz__scroll">
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={cell} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={`${row[0]}-${head[index]}`}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------ trend line */

export type TrendSeries = {
  label: string;
  /** Oldest first. */
  values: number[];
  tone?: Tone;
};

/**
 * A value over time: a 2px line, its hue washed under it at 10%, and an
 * optional comparison series in the de-emphasis grey. The crosshair snaps to
 * the nearest day and the read-out lists every series at that day, so the
 * pointer aims at a date rather than at a line.
 */
export function TrendChart({
  series,
  labels,
  format,
  tableCaption,
  rowLabel = "Day",
}: {
  /** The subject first; an optional comparison second, drawn in grey. */
  series: TrendSeries[];
  /** One per point, oldest first — dates, mostly. */
  labels: string[];
  format: (value: number) => string;
  tableCaption: string;
  rowLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [subject, compare] = series;
  const count = subject.values.length;
  const max = niceMax(Math.max(...series.flatMap((entry) => entry.values)));
  const hex = TONE_HEX[subject.tone ?? "mint"];

  const x = (index: number) => (count > 1 ? (index / (count - 1)) * 100 : 50);
  const y = (value: number) => 100 - (value / max) * 100;
  const path = (values: number[]) =>
    values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");

  const last = subject.values[count - 1];
  const shown = active ?? count - 1;

  return (
    <div className="aui-viz">
      <div
        aria-label={`${tableCaption}. Use the arrow keys to walk the days; the values are also in the table below.`}
        className="aui-viz__plot"
        onKeyDown={(event) => {
          const next = stepIndex(event, active, count);
          if (next !== active) {
            event.preventDefault();
            setActive(next);
          }
        }}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => setActive(nearestIndex(event, count, false))}
        role="application"
        tabIndex={0}
      >
        {/* Hairline solid gridlines, the baseline a step firmer. */}
        <i aria-hidden className="aui-viz__grid" style={{ top: 0 }} />
        <i aria-hidden className="aui-viz__grid" style={{ top: "50%" }} />
        <i aria-hidden className="aui-viz__grid aui-viz__grid--base" style={{ top: "100%" }} />
        <span aria-hidden className="aui-viz__tick" style={{ top: 0 }}>
          {format(max)}
        </span>
        <span aria-hidden className="aui-viz__tick" style={{ top: "50%" }}>
          {format(max / 2)}
        </span>

        <svg aria-hidden className="aui-viz__paper" preserveAspectRatio="none" viewBox="0 0 100 100">
          {compare && (
            <path
              d={path(compare.values)}
              fill="none"
              stroke={COMPARE}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={`${path(subject.values)} L100 100 L0 100 Z`}
            fill={hex}
            opacity={0.1}
            stroke="none"
          />
          <path
            d={path(subject.values)}
            fill="none"
            stroke={hex}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {active !== null && (
          <i aria-hidden className="aui-viz__cross" style={{ left: `${x(active)}%` }} />
        )}

        {/* The current position's dots — the end of the line when idle. */}
        <i
          aria-hidden
          className="aui-viz__dot"
          style={{ left: `${x(shown)}%`, top: `${y(subject.values[shown])}%`, background: hex }}
        />
        {compare && active !== null && (
          <i
            aria-hidden
            className="aui-viz__dot"
            style={{ left: `${x(active)}%`, top: `${y(compare.values[active])}%`, background: COMPARE }}
          />
        )}

        {/* The one direct label: the line's endpoint. Hovering replaces it. */}
        {active === null && (
          <span
            className="aui-viz__endlabel"
            style={{ top: `${y(last)}%` }}
          >
            {format(last)}
          </span>
        )}

        {active !== null && (
          <Readout
            at={x(active)}
            rows={series.map((entry) => ({
              label: entry.label,
              value: format(entry.values[active]),
              swatch: entry === subject ? hex : COMPARE,
            }))}
            title={labels[active]}
          />
        )}
      </div>

      <div aria-hidden className="aui-viz__x">
        <span>{labels[0]}</span>
        {count > 2 && <span>{labels[Math.floor((count - 1) / 2)]}</span>}
        <span>{labels[count - 1]}</span>
      </div>

      {series.length > 1 && (
        <div className="aui-viz__legend">
          {series.map((entry) => (
            <span key={entry.label}>
              <i style={{ background: entry === subject ? hex : COMPARE }} />
              {entry.label}
            </span>
          ))}
        </div>
      )}

      <TableTwin
        caption={tableCaption}
        head={[rowLabel, ...series.map((entry) => entry.label)]}
        rows={labels.map((label, index) => [
          label,
          ...series.map((entry) => format(entry.values[index])),
        ])}
      />
    </div>
  );
}

/* --------------------------------------------------------------- columns */

/**
 * A count per period: one hue, columns capped at 24px with a 4px rounded
 * data-end, square at the baseline, and a 2px gap doing the separating. The
 * whole plot is the hit target — the hovered column lifts and the read-out
 * names it.
 */
export function ColumnChart({
  values,
  labels,
  tone = "sky",
  format,
  unit,
  tableCaption,
  rowLabel = "Day",
}: {
  /** Oldest first. */
  values: number[];
  labels: string[];
  tone?: Tone;
  format: (value: number) => string;
  /** What one value is — "orders", "units". Read out beside the number. */
  unit: string;
  tableCaption: string;
  rowLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const count = values.length;
  const max = niceMax(Math.max(...values));
  const hex = TONE_HEX[tone];

  return (
    <div className="aui-viz">
      <div
        aria-label={`${tableCaption}. Use the arrow keys to walk the columns; the values are also in the table below.`}
        className="aui-viz__plot"
        onKeyDown={(event) => {
          const next = stepIndex(event, active, count);
          if (next !== active) {
            event.preventDefault();
            setActive(next);
          }
        }}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => setActive(nearestIndex(event, count, true))}
        role="application"
        tabIndex={0}
      >
        <i aria-hidden className="aui-viz__grid" style={{ top: 0 }} />
        <i aria-hidden className="aui-viz__grid" style={{ top: "50%" }} />
        <span aria-hidden className="aui-viz__tick" style={{ top: 0 }}>
          {format(max)}
        </span>
        <span aria-hidden className="aui-viz__tick" style={{ top: "50%" }}>
          {format(max / 2)}
        </span>

        <div aria-hidden className="aui-viz__cols">
          {values.map((value, index) => (
            <span className="aui-viz__slot" key={labels[index]}>
              <i
                data-lift={active === index ? "true" : undefined}
                style={{
                  height: `${Math.max(1.5, (value / max) * 100)}%`,
                  background: hex,
                }}
              />
            </span>
          ))}
        </div>

        {active !== null && (
          <Readout
            at={((active + 0.5) / count) * 100}
            rows={[{ label: unit, value: format(values[active]) }]}
            title={labels[active]}
          />
        )}
      </div>

      <div aria-hidden className="aui-viz__x">
        <span>{labels[0]}</span>
        {count > 2 && <span>{labels[Math.floor((count - 1) / 2)]}</span>}
        <span>{labels[count - 1]}</span>
      </div>

      <TableTwin
        caption={tableCaption}
        head={[rowLabel, unit]}
        rows={labels.map((label, index) => [label, format(values[index])])}
      />
    </div>
  );
}

/* -------------------------------------------------------------- bar rows */

export type BarRow = {
  label: string;
  /** What the bar measures. */
  value: number;
  /** How the number reads beside the bar — "12", "36 of 48". */
  display: string;
  /** A word beside the label when the row needs one — "Low", "Out". */
  flag?: string;
  flagTone?: "warn" | "bad";
  tone?: Tone;
};

/**
 * A breakdown: every row fully labelled — name on the left, value on the
 * right, both in text ink — so the bar is the comparison and never the only
 * copy of the number. No hover layer, because there is nothing it would add.
 */
export function BarRows({ rows, tone = "sky", max }: { rows: BarRow[]; tone?: Tone; max?: number }) {
  const ceiling = max ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="aui-viz__bars">
      {rows.map((row) => (
        <div className="aui-viz__bar" key={row.label} style={toneVars(row.tone ?? tone)}>
          <p>
            <span>
              {row.label}
              {row.flag && <b data-tone={row.flagTone ?? "warn"}>{row.flag}</b>}
            </span>
            <b>{row.display}</b>
          </p>
          <span className="aui-viz__track">
            <i style={{ width: `${Math.min(100, (row.value / ceiling) * 100)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
