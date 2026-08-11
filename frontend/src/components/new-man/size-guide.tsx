"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { sizesFor, type Piece } from "@/components/new-man/data";
import {
  SIZE_CHARTS,
  SIZE_CHART_ORDER,
  SIZE_GUIDE_COPY,
  chartIdFor,
  type SizeChartId,
} from "@/components/new-man/product-deck";
import { lockScroll } from "@/lib/scroll-lock";

type Unit = "cm" | "in";

/**
 * The size guide, as a dialog.
 *
 * It replaces a link that used to take a shopper off the product page to read a
 * table. That was the wrong shape for the moment it is asked for: the guide is
 * opened in the middle of choosing a size, and a route change threw away the
 * picker, the photograph and the scroll position to show something the page had
 * room for all along. Everything the old destination carried is here, and the
 * page it was covering is still underneath when it closes.
 *
 * It is drawn with hairlines and space rather than with boxes. What is on
 * screen is a table of numbers and four sentences about a tape measure; every
 * card, pill and badge around those was another edge competing with the figures
 * for the eye. Width is set by the widest chart at a comfortable measure — six
 * columns spread across a full-bleed dialog stop reading as rows.
 *
 * Portalled to <body> like the other two overlays on this route, so its rules
 * hang off its own class rather than `.nh-root` — see the `nsg` block at the
 * end of new-man.css.
 */
export function SizeGuide({
  piece,
  selected,
  onClose,
  onPickSize,
}: {
  piece: Piece;
  /** the size chosen on the page behind, so the table can mark its row */
  selected: string | null;
  onClose: () => void;
  /** when given, a row in this piece's own run becomes a way to choose it */
  onPickSize?: (size: string) => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <SizeGuidePanel
      onClose={onClose}
      onPickSize={onPickSize}
      piece={piece}
      selected={selected}
    />,
    document.body,
  );
}

function SizeGuidePanel({
  piece,
  selected,
  onClose,
  onPickSize,
}: {
  piece: Piece;
  selected: string | null;
  onClose: () => void;
  onPickSize?: (size: string) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const sizes = useMemo(() => sizesFor(piece), [piece]);
  /** the chart this piece is graded on, or null for the ungraded categories */
  const own = useMemo(() => chartIdFor(piece), [piece]);

  const [unit, setUnit] = useState<Unit>("cm");
  /* Opens on the piece's own chart. An ungraded piece has none, so it opens on
     tops — the first tab — rather than on nothing at all. */
  const [tab, setTab] = useState<SizeChartId>(own ?? "tops");

  const chart = SIZE_CHARTS[tab];

  /** the sizes this piece is actually offered in, for marking rows in the table */
  const run = useMemo(
    () => new Map(sizes.map((option) => [option.label, option.state])),
    [sizes],
  );

  /* --- the page underneath, and where focus goes ---------------------------
     Its own effect, with NO dependencies. The key handler below has to be
     rebuilt whenever `onClose` changes — it is an arrow in the parent, so that
     is every render — and a lock rebuilt on the same schedule would release the
     page for a frame each time and re-read its "previous" state from itself.
     Taking it once per mount is the whole point; `lockScroll` counts holders,
     so this nests correctly under the quick-add panel's lock. */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const release = lockScroll();

    return () => {
      release();
      opener?.focus?.();
    };
  }, []);

  /* --- escape, the tablist on the arrows, and the focus trap --------------- */
  useEffect(() => {
    /* CAPTURE, and it stops the keys it owns from travelling any further. This
       dialog can be opened from inside the quick-add panel, which has a keydown
       listener of its own on the document — without this, one Escape would
       close the guide and the panel underneath it in the same press, Tab would
       be trapped by whichever of the two handlers ran second, and the arrows
       would drive a carousel nobody can see behind the overlay. Everything else
       reaches the page as usual. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      /* The tablist on the arrows, which is what a tablist is meant to answer
         to — and it is why they are swallowed rather than merely blocked. */
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.stopPropagation();
        if (!dialog.current?.contains(document.activeElement)) return;
        if (!(document.activeElement as HTMLElement)?.closest?.('[role="tab"]'))
          return;

        event.preventDefault();
        setTab((current) => {
          const at = SIZE_CHART_ORDER.indexOf(current);
          const step = event.key === "ArrowLeft" ? -1 : 1;
          const next =
            (at + step + SIZE_CHART_ORDER.length) % SIZE_CHART_ORDER.length;
          /* focus follows selection, as it does in an automatic tablist */
          dialog.current
            ?.querySelector<HTMLElement>(`#nsg-tab-${SIZE_CHART_ORDER[next]}`)
            ?.focus();
          return SIZE_CHART_ORDER[next];
        });
        return;
      }

      if (event.key !== "Tab" || !dialog.current) return;
      event.stopPropagation();

      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const pick = useCallback(
    (size: string) => {
      onPickSize?.(size);
      onClose();
    },
    [onClose, onPickSize],
  );

  return (
    <div className="nsg" role="presentation">
      <motion.div
        animate={{ opacity: 1 }}
        className="nsg__scrim"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        transition={{ duration: 0.28, ease: EASE_OUT }}
      />

      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="nsg-title"
        aria-modal="true"
        className="nsg__panel"
        exit={{ opacity: 0, y: reduce ? 0 : 14, scale: reduce ? 1 : 0.985 }}
        initial={{ opacity: 0, y: reduce ? 0 : 20, scale: reduce ? 1 : 0.985 }}
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: reduce ? 0 : 0.38, ease: EASE_OUT }}
      >
        {/* ------------------------------------------------------------ head */}
        {/* One line of identity and one control. The release, the category and
            a standfirst were three more things to read before the table, and
            the table is the entire reason anybody opens this. */}
        <header className="nsg__head">
          <h2 className="nsg__title" id="nsg-title">
            Size guide
            <span>{piece.name}</span>
          </h2>

          {/* Units, not a setting: it converts the one authored figure rather
              than swapping in a second table, so the two can never disagree. */}
          <div aria-label="Units" className="nsg__units" role="radiogroup">
            {(["cm", "in"] as Unit[]).map((value) => (
              <button
                aria-checked={unit === value}
                className="nsg__unit"
                data-on={unit === value}
                key={value}
                onClick={() => setUnit(value)}
                role="radio"
                type="button"
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            aria-label="Close size guide"
            className="nsg__close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={16} />
          </button>
        </header>

        {/* ------------------------------------------------------------ body */}
        {/* `data-lenis-prevent` is what makes this scroll AT ALL. Lenis drives
            the window on this route and swallows the wheel before it reaches
            anything, so without the flag the dialog is a fixed box with the
            bottom half of its content unreachable. Lenis walks up from the
            event target looking for exactly this attribute and stands down. */}
        <div className="nsg__body" data-lenis-prevent>
          {/* ------------------------------------------------------- charts */}
          <div aria-label="Garment charts" className="nsg__tabs" role="tablist">
            {SIZE_CHART_ORDER.map((id) => (
              <button
                aria-controls="nsg-chart"
                aria-selected={tab === id}
                className="nsg__tab"
                /* which of the three the piece on the page belongs to — without
                   it a shopper has to know their own garment taxonomy to pick
                   the right tab. A dot, not a badge: it only has to be found
                   once, and it sits in a row of three words. */
                data-own={own === id || undefined}
                data-on={tab === id}
                id={`nsg-tab-${id}`}
                key={id}
                onClick={() => setTab(id)}
                role="tab"
                type="button"
              >
                {SIZE_CHARTS[id].label}
                {own === id && <span className="nsg__srOnly"> — this piece</span>}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`nsg-tab-${tab}`}
            id="nsg-chart"
            role="tabpanel"
            tabIndex={-1}
          >
            <p className="nsg__caption">
              {own === null ? SIZE_GUIDE_COPY.ungraded : chart.caption}
            </p>

            {/* The one horizontally scrolling thing in the dialog, and only on
                a narrow window — six columns of figures do not fold. */}
            <div className="nsg__tableWrap">
              <table className="nsg__table">
                <caption className="nsg__srOnly">
                  {chart.label} measurements in{" "}
                  {unit === "cm" ? "centimetres" : "inches"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Size</th>
                    {chart.measures.map((measure) => (
                      <th data-body={measure.body} key={measure.key} scope="col">
                        {measure.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row) => {
                    const state = run.get(row.size);
                    const mine = selected === row.size;
                    /* Pressable only when it is a size THIS piece is offered in
                       and still has: a row that quietly did nothing on a chart
                       the piece is not even graded on reads as broken. */
                    const choosable =
                      Boolean(onPickSize) &&
                      own === tab &&
                      state !== undefined &&
                      state !== "out";

                    return (
                      <tr
                        data-mine={mine || undefined}
                        data-out={state === "out" || undefined}
                        key={row.size}
                      >
                        <th scope="row">
                          {choosable ? (
                            <button
                              className="nsg__pick"
                              onClick={() => pick(row.size)}
                              type="button"
                            >
                              {row.size}
                            </button>
                          ) : (
                            row.size
                          )}
                          {/* The run as it actually stands, read off the
                              catalogue rather than off the chart: a guide that
                              lists an M the page has sold out is worse than no
                              guide. Small and grey — it is a footnote to the
                              size, not a second column. */}
                          {state === "out" && <i>sold out</i>}
                          {state === "low" && <i data-tone="low">low</i>}
                        </th>

                        {row.values.map((value, index) => (
                          <td
                            data-body={chart.measures[index].body}
                            key={chart.measures[index].key}
                          >
                            {format(value, unit)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="nsg__tableNote">
              {chart.measures.some((m) => m.body)
                ? "Grey column is your own body, measured round. The rest is the garment, laid flat."
                : "Garment laid flat."}
              {onPickSize && own === tab && " Press a size to choose it."}
            </p>
          </div>

          {/* ------------------------------------------------ how to measure */}
          <section className="nsg__block">
            <h3 className="nsg__blockHead">How to measure</h3>

            <div className="nsg__measure">
              <Diagram kind={chart.diagram} />

              <ol className="nsg__steps">
                {chart.steps.map((step, index) => (
                  <li className="nsg__step" key={step.title}>
                    <span className="nsg__stepNum">{index + 1}</span>
                    <span className="nsg__stepText">
                      <b>{step.title}</b> {step.body}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ------------------------------------------------------- notes */}
          <section className="nsg__block">
            <h3 className="nsg__blockHead">Between sizes</h3>

            <dl className="nsg__notes">
              {SIZE_GUIDE_COPY.notes.map((note) => (
                <div className="nsg__note" key={note.title}>
                  <dt>{note.title}</dt>
                  <dd>{note.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="nsg__policy">{SIZE_GUIDE_COPY.footer}</p>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One centimetre figure, in whichever unit is on.
 *
 * Inches are rounded to a quarter, which is how a tape is actually read — 21.26
 * is a conversion artefact, not a measurement, and printing it to two decimals
 * claims a precision the garment does not have.
 */
function format(cm: number, unit: Unit) {
  if (unit === "cm") return trim(cm);
  return trim(Math.round((cm / 2.54) * 4) / 4);
}

const trim = (value: number) =>
  value % 1 === 0 ? String(value) : String(Number(value.toFixed(2)));

/**
 * The silhouette beside the steps, drawn rather than photographed: a photograph
 * of a garment on a table shows a garment on a table, and what the steps need
 * shown is WHERE the four lines fall. Both are `aria-hidden` — every line in
 * here is named in the ordered list next to it, so a reader that cannot see the
 * drawing loses nothing.
 */
function Diagram({ kind }: { kind: "top" | "trouser" }) {
  return (
    <div className="nsg__diagram">
      <svg aria-hidden viewBox="0 0 200 220" role="presentation">
        {kind === "top" ? (
          <>
            {/* body, sleeves and collar, as one outline — a tee face down on
                the table, which is the position every figure is taken in */}
            <path
              className="nsg__d-shape"
              d="M78 32 L58 40 L24 58 L34 88 L58 76 L58 196 L142 196 L142 76 L166 88 L176 58 L142 40 L122 32 Q100 52 78 32 Z"
            />
            {/* the seam the shoulder figure is taken between */}
            <path className="nsg__d-line" d="M58 40 L58 76 M142 40 L142 76" />

            {/* Each measure sits OFF the garment wherever it can — a dashed
                rule over the fill is hard to follow, and the two that cannot
                (chest, sleeve) are the two that only mean anything on it. */}
            {/* 1 · chest, one inch below the armhole */}
            <path className="nsg__d-measure" d="M58 92 L142 92" />
            <circle className="nsg__d-dot" cx="58" cy="92" r="3" />
            <circle className="nsg__d-dot" cx="142" cy="92" r="3" />
            <text className="nsg__d-tag" x="100" y="86">
              1
            </text>

            {/* 2 · body length, clear of the sleeve on the right */}
            <path className="nsg__d-measure" d="M186 40 L186 196" />
            <circle className="nsg__d-dot" cx="186" cy="40" r="3" />
            <circle className="nsg__d-dot" cx="186" cy="196" r="3" />
            <text className="nsg__d-tag" x="193" y="122">
              2
            </text>

            {/* 3 · shoulder, floated above the garment */}
            <path className="nsg__d-measure" d="M58 22 L142 22" />
            <circle className="nsg__d-dot" cx="58" cy="22" r="3" />
            <circle className="nsg__d-dot" cx="142" cy="22" r="3" />
            <text className="nsg__d-tag" x="100" y="16">
              3
            </text>

            {/* 4 · sleeve, neck seam over the shoulder to the cuff */}
            <path className="nsg__d-measure" d="M100 38 L58 44 L29 74" />
            <circle className="nsg__d-dot" cx="100" cy="38" r="3" />
            <circle className="nsg__d-dot" cx="29" cy="74" r="3" />
            <text className="nsg__d-tag" x="22" y="90">
              4
            </text>
          </>
        ) : (
          <>
            {/* waistband, seat and two legs, as one outline */}
            <path
              className="nsg__d-shape"
              d="M52 22 L148 22 L156 96 L134 200 L106 200 L100 118 L94 200 L66 200 L44 96 Z"
            />
            <path className="nsg__d-line" d="M52 40 L148 40" />

            {/* 1 · waist */}
            <path className="nsg__d-measure" d="M52 30 L148 30" />
            <circle className="nsg__d-dot" cx="52" cy="30" r="3" />
            <circle className="nsg__d-dot" cx="148" cy="30" r="3" />
            <text className="nsg__d-tag" x="100" y="16">
              1
            </text>

            {/* 2 · hip */}
            <path className="nsg__d-measure" d="M47 68 L153 68" />
            <circle className="nsg__d-dot" cx="47" cy="68" r="3" />
            <circle className="nsg__d-dot" cx="153" cy="68" r="3" />
            <text className="nsg__d-tag" x="100" y="62">
              2
            </text>

            {/* 3 · inseam */}
            <path className="nsg__d-measure" d="M120 118 L120 200" />
            <circle className="nsg__d-dot" cx="120" cy="118" r="3" />
            <circle className="nsg__d-dot" cx="120" cy="200" r="3" />
            <text className="nsg__d-tag" x="130" y="162">
              3
            </text>

            {/* 4 · front rise */}
            <path className="nsg__d-measure" d="M100 118 L100 22" />
            <circle className="nsg__d-dot" cx="100" cy="118" r="3" />
            <circle className="nsg__d-dot" cx="100" cy="22" r="3" />
            <text className="nsg__d-tag" x="86" y="96">
              4
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
