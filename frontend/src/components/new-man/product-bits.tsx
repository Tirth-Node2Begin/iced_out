"use client";

import { Star, Timer } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import type { Frame } from "@/components/new-man/data";
import { DISPATCH_WINDOW_SECONDS } from "@/components/new-man/product-deck";

/**
 * One framed photograph.
 *
 * The two framing modes and the custom properties they set are exactly the
 * ones the listing tiles use (see `frameFor` and the `.nh-mcard__media` rules
 * in new-man.css) — `.nmp-frame` is added to those selectors rather than given
 * arithmetic of its own, so a crop is framed identically wherever it appears.
 *
 * `instant` is for the gallery, where a frame is MOUNTED IN MOTION: the copy
 * that flies between the rail and the hero, and every layer the cross-fade
 * brings in, are new elements each time the shot changes. `async` decoding lets
 * the browser present such an element a frame or two after it is laid out, and
 * one frame of an empty card in the middle of a half-second move is the whole
 * glitch — it reads as the photograph loading, when the bytes have been in
 * memory since the page was drawn. `sync` costs nothing on an image already
 * decoded elsewhere on screen, which is exactly the case every time here.
 *
 * It is opt-in because the OTHER callers are the related-products grid and the
 * listing tiles, where images are genuinely arriving off the network and
 * blocking on them is the wrong trade.
 *
 * `className` names the wrapper, because the same three framing rules are
 * wanted under four different boxes — the hero's `.nmp-frame`, the listing
 * tile's `.nh-mcard__media`, the quick-add panel's `.nhq__shot` and the
 * viewer's `.nmv__shot`. Each of those used to carry its own copy of the
 * custom-property arithmetic; four copies is four places to forget the day a
 * mode is added, which is exactly what happened when `none` was.
 */
export function ProductFrame({
  frame,
  alt,
  instant,
  className = "nmp-frame",
}: {
  /**
   * `undefined` is treated as "no photograph", not as a mistake to throw on.
   *
   * A gallery is as long as the operator's own run now, so a held index can
   * outlive the run it was pointing into — the callers clamp for that, and this
   * is the floor under them. A product page that shows an empty frame for a
   * beat is a page; one that throws is a blank screen with a stack trace on it.
   */
  frame: Frame | undefined;
  alt: string;
  instant?: boolean;
  className?: string;
}) {
  if (!frame) return <span className={className} data-mode="none" />;

  return (
    <span className={className} data-mode={frame.mode}>
      {/* A piece nobody has photographed draws an empty frame and says so to
          nothing — the card around it already names the piece. It must NOT
          borrow a picture of another garment, which is what the sprite fallback
          here amounted to. */}
      {frame.mode === "none" ? (
        <span aria-hidden className="nmp-frame__blank" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          alt={alt}
          decoding={instant ? "sync" : "async"}
          // Images are natively draggable, and that gesture wins: without this
          // the browser starts its own drag-and-drop the moment a pointer moves
          // on the photograph, and the gallery's swipe never sees a single move.
          draggable={false}
          src={frame.src}
          style={
            frame.mode === "quad"
              ? ({
                  "--qx": frame.qx,
                  "--qy": frame.qy,
                  "--zoom": frame.zoom,
                } as CSSProperties)
              : ({ "--op": frame.op, "--zoom": frame.zoom } as CSSProperties)
          }
        />
      )}
    </span>
  );
}

/**
 * A five-star readout that can land on a half.
 *
 * Two full rows, one muted and one bright, with the bright row clipped to the
 * score's percentage. Rounding each star to the nearest whole instead would
 * turn a 4.5 into either a 4 or a 5, and the number printed beside it would
 * then disagree with the stars next to it.
 */
export function Stars({
  value,
  size = 13,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const row = Array.from({ length: 5 });

  return (
    <span
      aria-label={`${value} out of 5`}
      className={className ? `nmp-stars ${className}` : "nmp-stars"}
      role="img"
      style={{ "--pct": `${(value / 5) * 100}%` } as CSSProperties}
    >
      <span aria-hidden className="nmp-stars__row nmp-stars__row--base">
        {row.map((_, index) => (
          <Star key={index} size={size} strokeWidth={1.4} />
        ))}
      </span>
      <span aria-hidden className="nmp-stars__row nmp-stars__row--fill">
        {row.map((_, index) => (
          <Star key={index} size={size} strokeWidth={1.4} />
        ))}
      </span>
    </span>
  );
}

/**
 * The dispatch countdown, which sits in the buy column directly under the
 * product name — the deadline only means anything while a shopper is still
 * deciding, so it belongs beside the decision and not in a panel further down.
 *
 * It starts from a literal, never from the clock: this route is statically
 * exported, so a build-time reading and a hydration-time reading would differ
 * and React would throw the whole subtree away. The first paint is identical on
 * both sides, and the timer only starts once the client has mounted.
 */
export function DispatchStrip() {
  const [left, setLeft] = useState(DISPATCH_WINDOW_SECONDS);

  useEffect(() => {
    const id = window.setInterval(
      () => setLeft((value) => (value <= 0 ? 0 : value - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="nmp-dispatch">
      <Timer aria-hidden size={14} />
      Order in <b>{clock(left)}</b>
      <span className="nmp-dispatch__tail">to make today&rsquo;s dispatch</span>
    </p>
  );
}

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
