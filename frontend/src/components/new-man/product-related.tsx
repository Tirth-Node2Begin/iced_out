"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

import { useGenderPieces } from "@/components/gender/use-pieces";
import { SplitHeading } from "@/components/new-home/motion-primitives";
import {
  formatPrice,
  frameFor,
  pricingFor,
  type Piece,
} from "@/components/new-man/data";
import { ProductFrame, Stars } from "@/components/new-man/product-bits";
import {
  PRODUCT_COPY,
  productSlug,
  relatedTo,
} from "@/components/new-man/product-deck";

/** the widest the grid ever runs — the cascade has to agree with the stylesheet */
const COLUMNS = 4;

/**
 * 04 — "you might also like": four more pieces from the release, same category
 * first. Each tile carries the reference's meta block — rating, price, struck
 * MRP, discount badge — and links to that piece's own detail page.
 */
export function ProductRelated({ piece }: { piece: Piece }) {
  /* The rest of the release, from the database — so a piece the console added
     can be recommended and one it took down cannot. */
  const { pieces } = useGenderPieces("men");
  const related = useMemo(() => relatedTo(pieces, piece), [pieces, piece]);

  return (
    <section className="nh-section nmp-rel">
      <div className="nh-wrap">
        <div className="nmp-rel__head">
          <SplitHeading
            className="nmp-rel__title"
            segments={[...PRODUCT_COPY.relatedHeading]}
          />
        </div>

        <div className="nmp-rel__grid">
          {related.map((item, index) => (
            <RelatedCard index={index} key={item.id} piece={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RelatedCard({ piece, index }: { piece: Piece; index: number }) {
  const reduce = useReducedMotion();
  const frame = useMemo(() => frameFor(piece), [piece]);
  const price = useMemo(() => pricingFor(piece), [piece]);
  /* The product's own approved rating, not a number invented from its id.
     `reviewCount` is what decides whether the row appears at all — a piece
     nobody has written about has no score, and inventing one for the sake of a
     consistent card is how a shop ends up rating itself. */
  const reviews = piece.reviewCount ?? 0;
  const rating = piece.rating ?? 0;

  return (
    <motion.article
      className="nmp-card"
      data-sold={piece.soldOut ? "true" : undefined}
      // `initial` is never branched on the reduced-motion flag: it is the prop
      // Motion writes into the server-rendered style attribute, and the hook
      // always reports false on the server. Branching it hands React two
      // different style attributes and every tile fails to hydrate. The
      // preference is honoured on the transition, which collapses the move.
      initial={{ opacity: 0, y: 30, scale: 0.99 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.78,
              ease: [0.22, 1, 0.36, 1],
              delay: (index % COLUMNS) * 0.09,
            }
      }
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
    >
      <Link
        aria-label={`${piece.name}, ${formatPrice(price.price)}`}
        className="nmp-card__frame"
        href={`/new-man/piece?slug=${productSlug(piece)}`}
      >
        <ProductFrame alt={piece.name} frame={frame} />

        {piece.soldOut ? (
          <span className="nmp-flag nmp-flag--sold">Sold out</span>
        ) : (
          piece.isNew && <span className="nmp-flag">New</span>
        )}

        <span className="nmp-card__go">
          <ArrowUpRight aria-hidden size={15} />
        </span>
      </Link>

      <div className="nmp-card__info">
        <Link className="nmp-card__name" href={`/new-man/piece?slug=${productSlug(piece)}`}>
          {piece.name}
        </Link>

        {reviews > 0 && (
          <span className="nmp-card__rating">
            <Stars size={12} value={rating} />
            <span>
              {rating.toFixed(1)}/5
              <i className="nmp-card__reviews">
                ({reviews})
              </i>
            </span>
          </span>
        )}

        <span className="nmp-card__prices">
          <span className="nmp-card__price">{formatPrice(price.price)}</span>
          {price.mrp !== null && (
            <>
              <span className="nmp-card__mrp">
                <s>{formatPrice(price.mrp)}</s>
              </span>
              <span className="nmp-card__off">-{price.off}%</span>
            </>
          )}
        </span>
      </div>
    </motion.article>
  );
}
