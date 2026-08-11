"use client";

import { ArrowUpRight, Heart } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import {
  CATEGORIES,
  CROPS,
  formatPrice,
  type AudienceContent,
  type Category,
  type Piece,
} from "@/components/gender/data";
import { EASE_OUT, Reveal } from "@/components/gender/motion";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * 01 — THE RELEASE. `#gx-edit`, the hero's primary CTA target.
 *
 * A category rail and eight products. Eight is the cut-off because the page is
 * meant to be read, not scrolled — the foot pill carries anyone who wants the
 * other twelve to the full collection.
 *
 * The shadcn primitives carry the semantics: ToggleGroup gives the rail its
 * roving focus and single-selection, Button the save toggle and the foot pill.
 * `drop.css` re-skins them onto the house palette.
 */
const SHOWN = 8;

/** category → the label the rail shows for it, so the card can name its own */
const CATEGORY_LABEL = new Map(
  CATEGORIES.map((option) => [option.value, option.label] as const),
);

export function DropEdit({ content }: { content: AudienceContent }) {
  const [category, setCategory] = useState<Category | "all">("all");

  const matches = useMemo(
    () =>
      category === "all"
        ? content.pieces
        : content.pieces.filter((piece) => piece.category === category),
    [content.pieces, category],
  );

  const visible = matches.slice(0, SHOWN);

  return (
    <section aria-labelledby="gx-edit-title" className="gxd-section" id="gx-edit">
      <div className="gxd-wrap">
        <div className="gxd-head">
          <Reveal className="gxd-head__lead">
            <p className="gx-eyebrow">01 / The release</p>
            <h2 className="gxd-head__title" id="gx-edit-title">
              Shop the drop
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <ToggleGroup
              aria-label="Filter the release by category"
              className="gxd-filter"
              onValueChange={(value) => {
                /* Radix emits "" when the active item is pressed again; the
                   rail has no empty state, so that reads as "all" */
                if (!value) return setCategory("all");
                setCategory(value as Category | "all");
              }}
              type="single"
              value={category}
            >
              {CATEGORIES.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Reveal>
        </div>

        {visible.length === 0 ? (
          <div className="gxd-empty">
            <h3>Nothing in this filter.</h3>
            <p>Clear the category to see the rest of the release.</p>
          </div>
        ) : (
          <div className="gxd-grid">
            {visible.map((piece, index) => (
              <ProductCard index={index} key={piece.id} piece={piece} />
            ))}
          </div>
        )}

        <div className="gxd-foot">
          <Button asChild className="gxd-pill" variant="ghost">
            <Link href="/collections/drop-001">
              View all {content.pieces.length} pieces
              <span aria-hidden className="gxd-pill__dot">
                <ArrowUpRight size={15} />
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * The card.
 *
 * Photograph in a rounded frame that lifts on hover, a chip and a save button
 * over it, a CTA that rises out of its foot, and the name, price and category
 * as plain text underneath. The meta sits OUTSIDE the frame on purpose: the
 * frame moves on hover, and text that moves with it reads as a glitch.
 *
 * One link per card — a stretched anchor over the photograph, carrying the
 * accessible name. The name below is not a second link to the same place, and
 * the save button is a sibling of the anchor rather than a child, because a
 * button inside an anchor is invalid HTML that browsers resolve by dropping
 * one of the two.
 */
function ProductCard({ piece, index }: { piece: Piece; index: number }) {
  const reduce = useReducedMotion();
  const crop = CROPS[piece.crop];

  /* the shared wishlist rather than a local flag — a heart that only fills in
     until the next navigation is a heart that saves nothing */
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(piece.id);

  const toggleSaved = useCallback(() => toggle(piece.id), [piece.id, toggle]);

  return (
    <motion.article
      className="gxd-card"
      data-sold={piece.soldOut ? "true" : undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { duration: 0.62, ease: EASE_OUT, delay: (index % 4) * 0.06 }
      }
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="gxd-card__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          decoding="async"
          loading="lazy"
          src={crop.src}
          style={{ "--op": crop.op, "--z": crop.z ?? 1 } as React.CSSProperties}
        />

        <Link
          aria-label={`${piece.name} — ${formatPrice(piece.price)}`}
          className="gxd-card__hit"
          href={`/product/${piece.slug}`}
        />

        <span className="gxd-card__chip" data-new={piece.isNew ? "true" : undefined}>
          {piece.isNew ? "New" : piece.tag}
        </span>

        <Button
          aria-label={saved ? `Remove ${piece.name} from wishlist` : `Save ${piece.name}`}
          aria-pressed={saved}
          className="gxd-save"
          data-on={saved}
          onClick={toggleSaved}
          size="icon-sm"
          variant="ghost"
        >
          <Heart aria-hidden className="size-3.5" />
        </Button>

        {piece.soldOut ? (
          <span className="gxd-card__flag">Sold out</span>
        ) : (
          <span aria-hidden className="gxd-card__cta">
            View piece
            <span>
              <ArrowUpRight size={14} />
            </span>
          </span>
        )}
      </div>

      <div className="gxd-card__body">
        <div className="gxd-card__row">
          <span className="gxd-card__name">{piece.name}</span>
          <span className="gxd-card__price">
            {formatPrice(piece.price)}
            {piece.compareAt && <s>{formatPrice(piece.compareAt)}</s>}
          </span>
        </div>
        <p className="gxd-card__sub">
          {CATEGORY_LABEL.get(piece.category) ?? piece.category}
        </p>
      </div>
    </motion.article>
  );
}
