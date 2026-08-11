"use client";

import {
  CalendarDays,
  ChevronDown,
  Package,
  Percent,
  Truck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Reveal } from "@/components/new-home/motion-primitives";
import { pricingFor, productFor, type Piece } from "@/components/new-man/data";
import {
  CATEGORY_LABELS,
  PRODUCT_COPY,
  SHIPPING,
} from "@/components/new-man/product-deck";

type PanelId = "description" | "shipping";

/**
 * The least body height the pair is allowed to settle on.
 *
 * Without a floor the shared height is whatever the SHORTER card needs, and a
 * short shipping block would crop the description mid-spec. This is the point
 * below which "see more" stops being a courtesy and starts being the only way
 * to read the panel at all.
 */
const FLOOR = 244;

/**
 * 02 — the two panels the reference hangs under the buy box: what the piece is,
 * and how it gets to you.
 *
 * They sit in their own band rather than inside the buy column. The hero is
 * already three tracks wide and a shopper reading a fabric spec is no longer
 * choosing a size, so folding these in beside the CTA would only make the first
 * screen taller than the fold for the sake of matching a screenshot.
 *
 * THE TWO CARDS ARE ALWAYS THE SAME HEIGHT. That height is negotiated here
 * rather than by either card, because neither can see the other: each reports
 * the height its content actually wants, and this component picks one figure
 * for both. Whichever card cannot fit its content in that figure — and only
 * that card — grows a "see more". Nothing collapses on its own; the pair simply
 * lines up, and the reader opts into the rest.
 */
export function ProductPanels({ piece }: { piece: Piece }) {
  const product = productFor(piece);
  const price = pricingFor(piece);

  const [wanted, setWanted] = useState<Partial<Record<PanelId, number>>>({});
  const [open, setOpen] = useState<Partial<Record<PanelId, boolean>>>({});

  const report = useCallback((id: PanelId, height: number) => {
    setWanted((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  const toggle = useCallback((id: PanelId) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /* The shared figure, once both cards have reported.
     - both fit inside the floor  → the taller one sets it, nobody is cropped
     - one runs long              → the shorter one sets it, the long one clamps
     - both run short of the floor → the floor sets it
     Taking `min(tallest, …)` last is what stops the pair reserving height that
     neither card has anything to put in. */
  const heights = Object.values(wanted);
  const shared =
    heights.length === 2
      ? Math.min(Math.max(...heights), Math.max(Math.min(...heights), FLOOR))
      : null;

  return (
    <section className="nh-section nmp-panels" id="nmp-details">
      <div className="nh-wrap">
        <div className="nmp-panels__grid">
          <Reveal>
            <Panel
              id="description"
              onMeasure={report}
              onToggle={toggle}
              open={Boolean(open.description)}
              shared={shared}
              title="Description & fit"
            >
              <p className="nh-body nmp-panel__lead">
                {product?.description ?? piece.name}
              </p>
              {product?.story && <p className="nh-body">{product.story}</p>}

              <dl className="nmp-specs">
                <Spec label="Category" value={CATEGORY_LABELS[piece.category]} />
                <Spec label="Fabric" value={product?.fabric ?? "Heavyweight cotton"} />
                <Spec label="Colour" value={product?.color ?? "Washed black"} />
                <Spec label="Collection" value={product?.collection ?? "Drop 001"} />
                <Spec label="Fit" value="Boxy body, dropped shoulder" />
                <Spec label="Care" value={product?.care ?? "Cold wash. Dry flat."} />
              </dl>
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <Panel
              id="shipping"
              onMeasure={report}
              onToggle={toggle}
              open={Boolean(open.shipping)}
              shared={shared}
              title="Shipping"
            >
              <ul className="nmp-facts">
                <Fact
                  icon={<Percent aria-hidden size={15} />}
                  label="Discount"
                  value={`${price.off}% off applied`}
                />
                <Fact
                  icon={<Package aria-hidden size={15} />}
                  label="Package"
                  value={SHIPPING.packageLabel}
                />
                <Fact
                  icon={<Truck aria-hidden size={15} />}
                  label="Delivery time"
                  value={SHIPPING.delivery}
                />
                <Fact
                  icon={<CalendarDays aria-hidden size={15} />}
                  label="Estimated arrival"
                  value={SHIPPING.arrival}
                />
              </ul>

              <ul className="nmp-panel__notes">
                {PRODUCT_COPY.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Panel>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Panel({
  id,
  title,
  shared,
  open,
  onMeasure,
  onToggle,
  children,
}: {
  id: PanelId;
  title: string;
  /** the height both cards have agreed on, or null until both have reported */
  shared: number | null;
  open: boolean;
  onMeasure: (id: PanelId, height: number) => void;
  onToggle: (id: PanelId) => void;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [wants, setWants] = useState<number | null>(null);

  /* The body is measured, not guessed. It sits in normal flow inside a clipped
     wrapper, so its own height stays content-driven however short the wrapper
     is cut — which is what makes this safe to re-read at any time. The observer
     is what catches the late passes nobody controls: a webfont swapping in, a
     specification wrapping onto a second line at some in-between width. */
  useEffect(() => {
    const element = body.current;
    if (!element) return;

    const measure = () => {
      const height = element.offsetHeight;
      setWants(height);
      onMeasure(id, height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, onMeasure]);

  const clamped = shared !== null && wants !== null && wants > shared + 2;

  /* Before the first measurement the wrapper is left to size itself, so the
     card renders complete and correct even if the effect never runs. The jump
     from that natural height to the shared one is not animated — CSS cannot
     interpolate out of `auto`, which is exactly the behaviour wanted here: the
     pair lines up on arrival, and only a press animates after that. */
  const height = shared === null ? undefined : open && wants !== null ? wants : shared;

  return (
    <section className="nmp-panel">
      <h2 className="nmp-panel__head">{title}</h2>

      <div
        className="nmp-panel__reveal"
        data-fade={clamped && !open ? "true" : undefined}
        style={{ height }}
      >
        <div className="nmp-panel__body" ref={body}>
          {children}
        </div>
      </div>

      {/* The foot is always in the DOM, with or without a button in it. It is
          part of what makes the two cards the same height, and a slot that
          appears only on the card that needs it would put the pair back out of
          step by exactly the height of one control. */}
      <div className="nmp-panel__foot">
        {clamped && (
          <button
            aria-expanded={open}
            className="nmp-panel__more"
            onClick={() => onToggle(id)}
            type="button"
          >
            {open ? "See less" : "See more"}
            <ChevronDown
              aria-hidden
              className="nmp-panel__moreIcon"
              data-open={open}
              size={14}
            />
          </button>
        )}
      </div>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="nmp-spec2">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="nmp-fact">
      <span className="nmp-fact__icon">{icon}</span>
      <span className="nmp-fact__text">
        <span className="nmp-fact__label">{label}</span>
        <span className="nmp-fact__value">{value}</span>
      </span>
    </li>
  );
}
