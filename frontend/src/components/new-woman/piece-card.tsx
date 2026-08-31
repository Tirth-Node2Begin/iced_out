"use client";

import { Expand, Heart } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo } from "react";

import {
  formatPrice,
  frameFor,
  pricingFor,
  type Piece,
} from "@/components/new-man/data";
import { CATEGORY_LABELS, productSlug } from "@/components/new-man/product-deck";
import { ProductFrame } from "@/components/new-man/product-bits";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";

/**
 * How many tracks the grid draws, which the entrance cascade counts in.
 *
 * Three, matching `.nw-grid` at its widest. Under-counting only lets the last
 * tile of a row land a beat early; over-counting puts a hard delay jump at the
 * start of every visual row, which is the one that reads as a stutter.
 */
const COLUMNS = 3;

/**
 * A women's product tile.
 *
 * Same catalogue, same framing arithmetic and the same two intents as the
 * men's tile — the photograph is a link to the product page, the quick view is
 * its own control — drawn to this floor's rules instead of that one's:
 *
 *   · the frame is arched, so its top corners cannot hold anything and all
 *     the furniture sits along the bottom edge;
 *   · the meta is two baseline rows (name / price, then category / reduction)
 *     rather than the men's stacked price block, and every cell is single-line
 *     and clipped — three tiles in a row must line up whatever they are called;
 *   · a rose index numbers the piece within the page, which is the one thing a
 *     numbered single run should be saying on every tile.
 */
export function PieceCard({
  piece,
  index,
  number,
  onSelect,
}: {
  piece: Piece;
  index: number;
  /** the piece's place in the whole filtered release, 1-based */
  number: number;
  onSelect: (piece: Piece) => void;
}) {
  const reduce = useReducedMotion();
  const frame = useMemo(() => frameFor(piece), [piece]);
  const price = useMemo(() => pricingFor(piece), [piece]);

  /* The shared wishlist, keyed on the piece rather than on the fixture slug it
     links to — see the men's tile for why that distinction matters. */
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(piece.id);
  const toggleSaved = useCallback(() => toggle(piece.id), [piece.id, toggle]);

  const href = `/new-woman/piece?slug=${productSlug(piece)}`;

  return (
    <motion.article
      className="nw-card"
      data-sold={piece.soldOut ? "true" : undefined}
      // Not branched on `reduce`: `initial` is the one prop Motion writes into
      // the server-rendered style attribute, and `useReducedMotion` always
      // reports false on the server — branching it hands React two different
      // style attributes and throws a hydration mismatch on every tile. The
      // preference is honoured on the transition, which collapses the move.
      initial={{ opacity: 0, y: 36 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
              delay:
                (index % COLUMNS) * 0.1 +
                Math.min(Math.floor(index / COLUMNS), 3) * 0.06,
            }
      }
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="nw-card__frame">
        {/* The three framing modes live in `ProductFrame`, so a tile and the
            page it opens can never draw the same crop differently. `none` is a
            piece nobody has photographed — an empty frame, never a picture of
            some other garment.

            TWO CLASSES, on purpose. `.nmp-frame` is where the crop arithmetic
            already lives — the shared rule in new-man.css that the men's tiles,
            the quick-add's shot and the product page's gallery all resolve
            through — and `.nw-card__media` is only this tile's positioning and
            hover. Naming both is what keeps a fourth copy of that arithmetic
            out of this page's sheet, which is exactly what `product-bits.tsx`
            asks callers to do. */}
        <ProductFrame
          alt={piece.name}
          className="nmp-frame nw-card__media"
          frame={frame}
        />

        <Link
          aria-label={`${piece.name}, ${formatPrice(price.price)} — view product`}
          className="nw-card__hit"
          href={href}
        />

        <div className="nw-card__foot">
          <span className="nw-card__flags">
            {piece.soldOut ? (
              <span className="nw-card__flag nw-card__flag--sold">Sold out</span>
            ) : (
              piece.isNew && <span className="nw-card__flag nw-card__flag--new">New</span>
            )}
          </span>

          <span className="nw-card__tools">
            <button
              aria-label={
                saved ? `Remove ${piece.name} from wishlist` : `Save ${piece.name}`
              }
              aria-pressed={saved}
              className="nw-card__tool nw-card__tool--heart"
              data-on={saved}
              onClick={toggleSaved}
              type="button"
            >
              <Heart aria-hidden size={14} strokeWidth={1.6} />
            </button>

            <button
              aria-label={`Quick view ${piece.name}`}
              className="nw-card__tool"
              onClick={() => onSelect(piece)}
              type="button"
            >
              <Expand aria-hidden size={14} strokeWidth={1.6} />
            </button>
          </span>
        </div>
      </div>

      <div className="nw-card__meta">
        <div className="nw-card__row">
          {/* The name is the second way into the product page: the frame's
              link stops at the photograph, and a title that looks like a title
              but does nothing reads as broken. */}
          <span className="nw-card__index" aria-hidden>
            {String(number).padStart(2, "0")}
          </span>
          <Link className="nw-card__name" href={href}>
            {piece.name}
          </Link>
          <span className="nw-card__price">{formatPrice(price.price)}</span>
        </div>

        <div className="nw-card__row">
          <span className="nw-card__sub">{CATEGORY_LABELS[piece.category]}</span>

          {/* Only where the catalogue records what the piece was reduced from.
              A piece sold at one price simply shows one — see `pricingFor`. */}
          {price.mrp !== null && (
            <span className="nw-card__reduction">
              <s className="nw-card__mrp">{formatPrice(price.mrp)}</s>
              <b className="nw-card__off">{price.off}% off</b>
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
