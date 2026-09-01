"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ProductImage } from "@/components/commerce/product-image";
import {
  formatPrice,
  matchesDestination,
  productPieceHref,
  useTrending,
  type Product,
} from "@/features/02-products";

import { ScrollWords } from "./motion";

/**
 * Top trending — the four pieces selling hardest, read from the register.
 *
 * It sits between the philosophy statement and the craft chapter: the page
 * argues for the cloth, then shows what people are actually buying, then
 * explains how it is made.
 *
 * NOTHING here is authored. The ranking arrives already sorted from
 * `GET /catalog/trending`, which orders the published catalogue by units
 * shipped over a rolling window with returns and cancellations taken back out
 * (see `CatalogRepository::trendingProducts`). Publish a piece and sell it and
 * it climbs into this row on the next load; there is no "featured" flag to tick
 * and no list in this file to maintain.
 *
 * The card is <Seasonal>'s card at a smaller size — same frame, same three
 * lines under it, same hover. Two product sections on one page that draw their
 * cards differently read as two different shops. What separates them is the
 * QUESTION each answers: this one is the register's ("what is selling"), the
 * one lower down is the operator's ("what is current").
 */

/** How many slots the row draws, and which side each one wants. */
const SLOTS = ["men", "women", "men", "women"] as const;

/**
 * The four the row draws: menswear and womenswear alternating down the slots,
 * each one the highest-ranked piece still unused on that side.
 *
 * Alternation is a LAYOUT rule, not a ranking one, which is why it lives here
 * and not in the SQL — the server's job is to say what is selling, and this
 * row's job is to make sure the front page does not show four of the same
 * thing. Rank still decides *which* piece takes a slot; the pattern only
 * decides which pool it is drawn from.
 *
 * Each slot is filled in three descending preferences:
 *
 *   1. a piece cut for that side          — `audience === side`
 *   2. anything that side's page lists    — `matchesDestination`, i.e. unisex
 *   3. anything left in the ranking       — the top-up loop below
 *
 * The strict pass comes first for a reason worth stating: unisex counts as both
 * men and women everywhere on this site, so a `matchesDestination`-only rule
 * hands the first two slots to the same two unisex pieces and the row reads as
 * four of one thing. Preferring the strict match puts a real menswear piece
 * opposite a real womenswear one, and unisex fills in only when a side has
 * genuinely run out.
 *
 * The final top-up is for a catalogue that cannot satisfy the pattern at all —
 * a shop with one womenswear listing, say. Four cards with the pattern bent
 * beats a row with a hole in it.
 */
function alternatingPicks(ranked: Product[]): Product[] {
  const taken = new Set<string>();
  const picked: Product[] = [];

  for (const side of SLOTS) {
    const next =
      ranked.find((product) => !taken.has(product.id) && product.audience === side) ??
      ranked.find((product) => !taken.has(product.id) && matchesDestination(product, side));

    if (next) {
      taken.add(next.id);
      picked.push(next);
    }
  }

  for (const product of ranked) {
    if (picked.length >= SLOTS.length) break;
    if (taken.has(product.id)) continue;
    taken.add(product.id);
    picked.push(product);
  }

  return picked;
}

function TrendCard({ product, index }: { product: Product; index: number }) {
  return (
    <article className="hv2-trend__card" data-aos="hv2-rise" data-aos-delay={index * 90}>
      <Link className="hv2-trend__link" href={productPieceHref(product)}>
        {/* `<ProductImage>` draws an empty frame for a piece nobody has
            photographed rather than standing a different garment in for it —
            the same contract every other card on the site keeps. */}
        <span className="hv2-trend__frame">
          <ProductImage alt={product.name} position={product.imagePosition} src={product.image} />
          {product.badge && <span className="hv2-trend__badge">{product.badge}</span>}
        </span>

        {/* Three lines and no more: what it is, what it is called, what it
            costs. The rank, the audience and the colour were all on this card
            at one point, and four cards' worth of that is a spec sheet rather
            than a shop front. The ranking is still legible — it is the order
            the cards are in. */}
        <span className="hv2-trend__meta">
          <span className="hv2-trend__descriptor">{product.category}</span>
          <span className="hv2-trend__name">{product.name}</span>
          <span className="hv2-trend__price">
            <strong>{formatPrice(product.price)}</strong>
            {product.compareAtPrice !== undefined && <s>{formatPrice(product.compareAtPrice)}</s>}
          </span>
        </span>
      </Link>
    </article>
  );
}

export function Trending() {
  const { data, loaded, error } = useTrending();
  const picks = useMemo(() => alternatingPicks(data), [data]);

  /* Nothing to stand behind, so nothing drawn — the same rule <Seasonal> keeps.
     A heading about what is selling over four empty boxes is a claim this page
     cannot make, and holding the section until the read has answered is what
     stops it flashing a row of placeholders on arrival. */
  if (!loaded || error !== null || picks.length === 0) return null;

  return (
    <section className="hv2-trend hv2-shell" id="trending">
      <div className="hv2-trend__head">
        <p className="hv2-eyebrow" data-aos="hv2-rise">
          Top trending
        </p>
        <ScrollWords
          as="h2"
          className="hv2-h2 hv2-trend__title"
          offset={["start 0.92", "start 0.55"]}
          spread={2.2}
          text="Moving fastest."
        />
      </div>

      <div className="hv2-trend__row">
        {picks.map((product, index) => (
          <TrendCard index={index} key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
