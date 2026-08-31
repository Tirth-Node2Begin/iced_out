"use client";

import { ArrowUpRight, Heart } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";

import {
  formatPrice,
  type Piece,
} from "@/components/gender/data";
import { EASE_OUT, Reveal, SplitHeading } from "@/components/gender/motion";
import { DEPTS, pieceHref, type Dept } from "@/components/new-man/product-deck";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { cn } from "@/lib/utils";

/**
 * The product tile.
 *
 * Entrance is a DIAGONAL CASCADE (§6.4 · 05): column position dominates at
 * 0.09s per column, the row adds a smaller 0.06s. On a 4-wide grid the first
 * two rows run 0, .09, .18, .27 / .06, .15, .24, .33 — the row washes in
 * left-to-right with each card just behind the last.
 */
function ProductTile({
  piece,
  index,
  columns,
  wide,
  dept,
}: {
  piece: Piece;
  dept: Dept;
  index: number;
  columns: number;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();

  /* The shared wishlist, not a local flag. The heart used to hold its own
     `useState`, so it filled in on press and emptied again on the next
     navigation, and nothing ever reached /wishlist or the account's Saved tab.
     The PIECE is what gets saved, not the fixture it is a display layer over —
     see `features/05-wishlist/saved-items`. */
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(piece.id);

  const toggleSaved = useCallback(() => toggle(piece.id), [piece.id, toggle]);

  /**
   * The tile is an <article> with a stretched link rather than one big <a>:
   * the heart is a real <button>, and a button nested inside an anchor is
   * invalid HTML that browsers resolve by dropping one of the two.
   */
  return (
    <motion.article
      className={cn("gx-card", wide && "gx-card--wide")}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 34, scale: 0.985 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : {
              duration: 0.78,
              ease: EASE_OUT,
              delay: (index % columns) * 0.09 + Math.floor(index / columns) * 0.06,
            }
      }
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
    >
      {/* The product's own photo, or an empty frame.
          It used to fall back to a quadrant of the house contact sheet, which
          meant a piece nobody had photographed was advertised with a picture of
          a different garment — and nothing on the card said so. */}
      <span className="gx-card__media">
        {piece.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt={piece.name} decoding="async" loading="lazy" src={piece.image} />
        ) : (
          <span aria-hidden className="gx-card__blank" />
        )}
      </span>
      <span className="gx-card__scrim" />

      <Link
        aria-label={`${piece.name} — ${formatPrice(piece.price)}`}
        className="gx-card__hit"
        href={pieceHref(dept, piece)}
      />

      <span className="gx-card__chips">
        <span className="gx-tag">{piece.isNew ? "New" : piece.tag}</span>
        <button
          aria-label={saved ? `Remove ${piece.name} from wishlist` : `Save ${piece.name}`}
          aria-pressed={saved}
          className="gx-heart"
          data-on={saved}
          onClick={toggleSaved}
          type="button"
        >
          <Heart aria-hidden size={13} />
        </button>
      </span>

      {piece.soldOut && <span className="gx-card__sold">Sold out</span>}

      <span className="gx-card__panel">
        <span className="gx-card__meta">
          <span className="gx-card__name">{piece.name}</span>
          <span className="gx-card__price">
            {formatPrice(piece.price)}
            {piece.compareAt && <s>{formatPrice(piece.compareAt)}</s>}
          </span>
        </span>
        <span className="gx-card__go">
          <ArrowUpRight aria-hidden size={14} />
        </span>
      </span>
    </motion.article>
  );
}

/**
 * A grid section. The head is the three-part `1fr auto 1fr` band from §5.8 —
 * eyebrow, centred title, eyebrow — and the foot is the inverted-circle pill.
 */
export function ProductShelf({
  id,
  eyebrow,
  heavy,
  light,
  right,
  foot,
  footHref = "/collections/view?slug=drop-001",
  pieces,
  columns = 4,
  wide,
  emptyNote,
  dept = DEPTS.men,
}: {
  id?: string;
  eyebrow: string;
  heavy: string;
  light: string;
  right: string;
  foot: string;
  footHref?: string;
  pieces: Piece[];
  columns?: 3 | 4;
  wide?: boolean;
  /**
   * What to say instead of "nothing in this filter".
   *
   * The catalogue arrives over the network, so an empty shelf has three possible
   * causes and only one of them is a filter. The page passes this when it knows
   * which — see `GenderPage`.
   */
  emptyNote?: string;
  /**
   * The floor these tiles are on — it decides which detail page they open.
   *
   * Defaults to menswear, which is where this shelf started. /women passes its
   * own, so a tile and the lookbook row under it agree about where a piece
   * lives; they used to both point at the storefront PDP instead.
   */
  dept?: Dept;
}) {
  if (pieces.length === 0) {
    return (
      <section className="gx-shelf" id={id}>
        <div className="gx-wrap gx-empty">
          <h3 className="gx-display">{emptyNote ?? "Nothing in this filter."}</h3>
          {emptyNote ? null : (
            <p className="gx-body">Clear the category to see the rest of the release.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="gx-shelf" id={id}>
      <div className="gx-wrap">
        <div className="gx-shelf__head">
          <Reveal>
            <p className="gx-eyebrow">{eyebrow}</p>
          </Reveal>
          <SplitHeading
            className="gx-shelf__title"
            segments={[{ text: heavy }, { text: light, light: true }]}
          />
          <Reveal delay={0.1}>
            <p className="gx-eyebrow gx-eyebrow--bare">{right}</p>
          </Reveal>
        </div>

        <div className={cn("gx-grid", columns === 3 && "gx-grid--3")}>
          {pieces.map((piece, index) => (
            <ProductTile
              columns={columns}
              dept={dept}
              index={index}
              key={piece.id}
              piece={piece}
              wide={wide}
            />
          ))}
        </div>

        <Reveal className="gx-shelf__foot" delay={0.15}>
          <Link className="gx-pill gx-pill--solid gx-pill--foot" href={footHref}>
            {foot}
            <span className="gx-pill__dot">
              <ArrowUpRight aria-hidden size={14} />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
