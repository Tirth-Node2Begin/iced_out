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
import { productSlug } from "@/components/new-man/product-deck";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { ProductFrame } from "@/components/new-man/product-bits";

/** The grid's default track count, which the entrance cascade reads off.
 *  Deliberately the four-track layout and not the five the widest breakpoint
 *  takes: over-counting columns puts a hard delay jump at the start of each
 *  visual row, while under-counting only lets the last tile in a row land a
 *  beat early. */
const COLUMNS = 4;

/**
 * A product tile.
 *
 * The frame is a LINK: selecting a piece goes to its product page, which is
 * what a shopper expects a photograph of a garment to do. The quick-add panel
 * — where a size is chosen and the bag is filled without leaving the listing —
 * is reached from the small expand control beside the wishlist instead, so the
 * two intents are separate targets rather than one overloaded one.
 *
 * The meta below the frame follows the supplied reference: selling price,
 * struck MRP, a percentage badge, then the name.
 */
function ProductTile({
  piece,
  index,
  onSelect,
}: {
  piece: Piece;
  index: number;
  onSelect: (piece: Piece) => void;
}) {
  const reduce = useReducedMotion();
  const frame = useMemo(() => frameFor(piece), [piece]);
  const price = useMemo(() => pricingFor(piece), [piece]);

  /* The shared wishlist, not a local flag: this heart used to fill in and then
     forget on the next navigation, so nothing it saved ever reached /wishlist
     or the account's Saved tab. The piece is saved as itself — twenty tiles
     share four fixture slugs, so saving the fixture would light five hearts at
     once. See `features/05-wishlist/saved-items`. */
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(piece.id);

  const toggleSaved = useCallback(() => toggle(piece.id), [piece.id, toggle]);

  return (
    <motion.article
      className="nh-mcard"
      data-sold={piece.soldOut ? "true" : undefined}
      // `initial` is deliberately NOT branched on `reduce`: it is the one prop
      // Motion writes into the server-rendered style attribute, and
      // useReducedMotion always reports false on the server — branching it
      // hands React two different style attributes to reconcile and throws a
      // hydration mismatch for every tile. The preference is honoured on the
      // transition instead, which collapses the move to nothing.
      initial={{ opacity: 0, y: 34, scale: 0.985 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.78,
              ease: [0.22, 1, 0.36, 1],
              // the delay is capped by the row so a "load more" page of tiles
              // never staggers itself into a several-second wait
              delay:
                (index % COLUMNS) * 0.09 +
                Math.min(Math.floor(index / COLUMNS), 3) * 0.06,
            }
      }
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
    >
      <div className="nh-mcard__frame">
        {/* Only five photographs ship in /public/images, so every tile is a
            framing of one of them. The modes are driven by custom properties
            the stylesheet reads (see `frameFor`): `crop` centres on a point and
            zooms around it, `quad` addresses one cell of the 2×2 contact sheet,
            and `none` is a piece nobody has photographed — an empty frame, never
            a picture of some other garment. `ProductFrame` owns all three, so a
            tile and the page it opens can never draw them differently. */}
        <ProductFrame alt={piece.name} className="nh-mcard__media" frame={frame} />

        {/* The frame itself goes to the product page. It sits under the
            controls in the corners so both of those stay pressable.

            The destination is this piece's own page under /new-man. The
            storefront PDP it could have shared with the fixture underneath is
            gone, and was never right anyway: twenty tiles share four fixture
            slugs, so it could only ever open one of four garments and a shopper
            selecting the Nightshift Overcoat landed on the overshirt. */}
        <Link
          aria-label={`${piece.name}, ${formatPrice(price.price)} — view product`}
          className="nh-mcard__hit"
          href={`/new-man/piece?slug=${productSlug(piece)}`}
        />

        <span className="nh-mcard__flags">
          {piece.soldOut ? (
            <span className="nh-mcard__flag nh-mcard__flag--sold">Sold out</span>
          ) : (
            piece.isNew && <span className="nh-mcard__flag">New</span>
          )}
        </span>

        {/* The two controls the tile carries, stacked in the corner above the
            link so neither is swallowed by it. */}
        <span className="nh-mcard__tools">
          <button
            aria-label={
              saved ? `Remove ${piece.name} from wishlist` : `Save ${piece.name}`
            }
            aria-pressed={saved}
            className="nh-mcard__tool nh-mcard__tool--heart"
            data-on={saved}
            onClick={toggleSaved}
            type="button"
          >
            <Heart aria-hidden size={13} />
          </button>

          {/* the quick-add, which used to be what the whole frame did */}
          <button
            aria-label={`Quick view ${piece.name}`}
            className="nh-mcard__tool"
            onClick={() => onSelect(piece)}
            type="button"
          >
            <Expand aria-hidden size={13} />
          </button>
        </span>
      </div>

      <div className="nh-mcard__info">
        <div className="nh-mcard__prices">
          <span className="nh-mcard__price">{formatPrice(price.price)}</span>
          {/* Only where the catalogue records what the piece was reduced from.
              These two used to render for every tile off an invented reference
              price — see `pricingFor`. A piece at one price simply shows one. */}
          {price.mrp !== null && (
            <>
              <span className="nh-mcard__mrp">
                MRP: <s>{formatPrice(price.mrp)}</s>
              </span>
              <span className="nh-mcard__off">{price.off}% OFF</span>
            </>
          )}
        </div>

        {/* the name is the second way into the product page — the frame's link
            stops at the photograph, and a title that looks like a title but
            does nothing reads as broken */}
        <Link className="nh-mcard__name" href={`/new-man/piece?slug=${productSlug(piece)}`}>
          {piece.name}
        </Link>
      </div>
    </motion.article>
  );
}

/**
 * The grid itself. It renders whatever the filter left — the empty state is
 * owned here rather than by the page, so there is exactly one place that
 * decides what "no results" looks like.
 */
export function ProductGrid({
  pieces,
  onReset,
  onSelect,
}: {
  pieces: Piece[];
  onReset: () => void;
  onSelect: (piece: Piece) => void;
}) {
  if (pieces.length === 0) {
    return (
      <div className="nh-mgrid__empty">
        <p className="nh-display nh-mgrid__emptyTitle">Nothing in this filter.</p>
        <p className="nh-body">
          Clear the filters to see the rest of the men&rsquo;s release.
        </p>
        <button
          className="nh-pill nh-pill--light"
          onClick={onReset}
          type="button"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="nh-mgrid">
      {pieces.map((piece, index) => (
        <ProductTile
          index={index}
          key={piece.id}
          onSelect={onSelect}
          piece={piece}
        />
      ))}
    </div>
  );
}
