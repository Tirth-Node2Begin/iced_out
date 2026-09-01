"use client";

import { useState } from "react";

import type { ProductImagePosition } from "@/features/02-products";

/* The component's own rules, imported here rather than left to whichever
   stylesheet a route group happened to pull in — `.product-photo` answered to
   nothing at all before this, so every uploaded shot drew at its natural size.
   See the sheet for the whole story. */
import "@/styles/components/product-image.css";

/**
 * A product's picture.
 *
 * `src` is the photograph an operator uploaded, served from the media endpoint.
 * When there is none, this draws an EMPTY frame — not a picture of something
 * else.
 *
 * It used to fall back to a quadrant of the sprite sheet that ships with the
 * app, chosen from the product's `imagePosition`. That put a photograph of a
 * hoodie on the card of a pair of jeans, and it did it silently: the shop
 * looked complete and every unphotographed piece was advertised as a different
 * garment. A shopper cannot tell a placeholder from a promise. Blank says "no
 * photograph yet", which is true; the sprite said something false.
 *
 * `fallback="sprite"` keeps the old behaviour for the two surfaces where the
 * sprite is the SUBJECT rather than a stand-in — the editorial destination
 * cards, and saved rows whose piece is a sprite quadrant by design.
 */
type ProductImageProps = {
  position: ProductImagePosition;
  /** The uploaded photo's URL. Empty or absent draws the empty frame. */
  src?: string;
  /** For the photo. The empty frame and the sprite are decorative. */
  alt?: string;
  className?: string;
  /** What to draw when there is no `src`. Defaults to nothing. */
  fallback?: "none" | "sprite";
};

export function ProductImage({
  position,
  src,
  alt = "",
  className = "",
  fallback = "none",
}: ProductImageProps) {
  /**
   * A photograph whose URL does not resolve.
   *
   * `src` being set means the product row NAMES a media asset; it does not mean
   * the file is there. A `media_assets` row can outlive its file — a storage
   * directory that was not copied between environments, an asset pruned behind
   * the catalogue's back — and the browser's answer to that is the broken-image
   * glyph and the alt text, drawn at whatever size the frame gives it. In a
   * full-bleed card that is a wrecked tile, and it says "this page is broken"
   * rather than the truth, which is "this photograph is missing".
   *
   * So a failed load falls through to the same branches an unphotographed piece
   * takes below. Keyed by `src` so a card that is reused for another product —
   * the shuffling seasonal row does exactly this — retries rather than
   * inheriting the previous piece's failure.
   */
  const [failed, setFailed] = useState("");

  if (src && failed !== src) {
    return (
      /* A plain <img>: the src is a runtime API URL, which the static export's
         image optimiser has no build-time way to resolve. */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        alt={alt}
        className={`product-photo ${className}`}
        loading="lazy"
        onError={() => setFailed(src)}
        src={src}
      />
    );
  }

  if (fallback === "sprite") {
    return (
      <div
        aria-hidden="true"
        className={`product-sprite product-sprite--${position} ${className}`}
      />
    );
  }

  /* Deliberately quiet: this sits inside a card that already names the piece
     and prints its price, so the frame does not need to explain itself twice.
     It reads as a photograph that has not been taken, which is what it is. */
  return <div aria-hidden="true" className={`product-blank ${className}`} />;
}
