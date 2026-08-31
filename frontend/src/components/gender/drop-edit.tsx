"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, Heart } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import {
  CATEGORIES,
  formatPrice,
  type AudienceContent,
  type Category,
  type Piece,
} from "@/components/gender/data";
import { EASE_OUT, Reveal } from "@/components/gender/motion";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEPTS, pieceHref, type Dept } from "@/components/new-man/product-deck";
import { scrollToHash } from "@/lib/in-page-scroll";

/**
 * 01 — THE RELEASE. `#gx-edit`, the hero's primary CTA target.
 *
 * A category rail and the published catalogue for this page's audience, paged
 * eight at a time.
 *
 * It used to show the first eight and nothing else, with a foot pill handing
 * anyone who wanted the rest to `/collections/view?slug=drop-001` — so the
 * filter rail was a promise the grid could not keep: narrowing to Outerwear
 * still showed eight of them and sent you somewhere unfiltered for the ninth.
 * The pager keeps the whole release on this page, inside the filter.
 *
 * The pieces used to be twenty hardcoded objects per audience, and the prices on
 * them disagreed with the database: this grid showed "Core Heavy Tee · ₹4,200"
 * while the product it linked to was ₹4,600, and sixteen of its twenty tiles named
 * garments that did not exist as products at all. See `use-pieces.ts`.
 *
 * The shadcn primitives carry the semantics: ToggleGroup gives the rail its
 * roving focus and single-selection, Button the save toggle and the pager steps.
 * `drop.css` re-skins them onto the house palette.
 */

/** Two rows of four at desktop — the shape the grid was drawn around. */
const PER_PAGE = 8;

/** category → the label the rail shows for it, so the card can name its own */
const CATEGORY_LABEL = new Map(
  CATEGORIES.map((option) => [option.value, option.label] as const),
);

export function DropEdit({ content }: { content: AudienceContent }) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [page, setPage] = useState(1);
  const { pieces, loading, error, loaded } = useGenderPieces(content.audience);

  const matches = useMemo(
    () =>
      category === "all"
        ? pieces
        : pieces.filter((piece) => piece.category === category),
    [pieces, category],
  );

  const pageCount = Math.max(1, Math.ceil(matches.length / PER_PAGE));

  /* The list can shrink out from under the page you are on — the catalogue
     lands, or a filter narrows twenty pieces to three while you are on page 3.
     Adjusted during render rather than in an effect so the grid never paints an
     empty page first and corrects itself afterwards. */
  if (page > pageCount) setPage(pageCount);

  const start = (page - 1) * PER_PAGE;
  const visible = matches.slice(start, start + PER_PAGE);

  /* Paging moves the viewport back to the section head. The new tiles render
     above the control that asked for them, so staying put leaves you looking at
     the foot of a grid that changed somewhere off-screen. */
  const goTo = useCallback((next: number) => {
    setPage(next);
    scrollToHash("gx-edit");
  }, []);

  /* An empty grid has three possible causes and only one of them is the rail. */
  const note = error
    ? error
    : loading && !loaded
      ? "Reading the release…"
      : pieces.length === 0
        ? "Nothing is published for this release yet."
        : null;

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
                /* Narrowing the release has to return you to its first page:
                   page 3 of everything is past the end of most categories. */
                setPage(1);
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
            <h3>{note ?? "Nothing in this filter."}</h3>
            {note ? null : <p>Clear the category to see the rest of the release.</p>}
          </div>
        ) : (
          <div className="gxd-grid">
            {visible.map((piece, index) => (
              <ProductCard
                dept={DEPTS[content.audience]}
                index={index}
                key={piece.id}
                piece={piece}
              />
            ))}
          </div>
        )}

        <Pager count={pageCount} onChange={goTo} page={page} total={matches.length} />
      </div>
    </section>
  );
}

/**
 * The page numbers to draw, with the run between them elided.
 *
 * Always the first and last, always the one either side of the current — so the
 * control is a fixed width whether the release is three pages or thirty, and
 * both ends stay one click away.
 */
function pageWindow(current: number, count: number): (number | "gap")[] {
  const wanted = [1, count, current - 1, current, current + 1]
    .filter((n) => n >= 1 && n <= count)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  for (const [index, n] of wanted.entries()) {
    if (index > 0) {
      const previous = wanted[index - 1];
      if (n === previous) continue;
      if (n - previous > 1) out.push("gap");
    }
    out.push(n);
  }
  return out;
}

/**
 * The pager, in the slot the foot pill used to hold.
 *
 * Hidden on a single page: a control offering one destination, which is where
 * you already are, is furniture. The count beside it is what the pill's "View
 * all 20 pieces" was really for — knowing how much release there is — and it
 * now reports the FILTERED total, which the pill never did.
 */
function Pager({
  page,
  count,
  total,
  onChange,
}: {
  page: number;
  count: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (count <= 1) return null;

  return (
    <nav aria-label="Release pages" className="gxd-pager">
      <Button
        aria-label="Previous page"
        className="gxd-pager__step"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        variant="ghost"
      >
        <ArrowLeft aria-hidden size={14} />
        Prev
      </Button>

      <div className="gxd-pager__pages">
        {pageWindow(page, count).map((entry, index) =>
          entry === "gap" ? (
            <span aria-hidden className="gxd-pager__gap" key={`gap-${index}`}>
              &hellip;
            </span>
          ) : (
            <Button
              aria-current={entry === page ? "page" : undefined}
              aria-label={`Page ${entry}`}
              className="gxd-pager__page"
              data-on={entry === page ? "true" : undefined}
              key={entry}
              onClick={() => onChange(entry)}
              variant="ghost"
            >
              {entry}
            </Button>
          ),
        )}
      </div>

      <Button
        aria-label="Next page"
        className="gxd-pager__step"
        disabled={page === count}
        onClick={() => onChange(page + 1)}
        variant="ghost"
      >
        Next
        <ArrowRight aria-hidden size={14} />
      </Button>

      {/* Announced on change, so the count is not something only the sighted
          grid carries. */}
      <p aria-live="polite" className="gxd-pager__count">
        {total} {total === 1 ? "piece" : "pieces"}
      </p>
    </nav>
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
 *
 * Where that anchor goes is `pieceHref`'s call, under the department this
 * listing is: the release now opens the full detail screen — hero, panels,
 * reviews, related — rather than the storefront PDP it used to hand you.
 */
function ProductCard({
  piece,
  index,
  dept,
}: {
  piece: Piece;
  index: number;
  dept: Dept;
}) {
  const reduce = useReducedMotion();

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
        {/* The piece's own photo, or an empty frame — never a crop of another
            garment standing in for one that has not been shot. */}
        {piece.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt="" decoding="async" loading="lazy" src={piece.image} />
        ) : (
          <span aria-hidden className="gxd-card__blank" />
        )}

        <Link
          aria-label={`${piece.name} — ${formatPrice(piece.price)}`}
          className="gxd-card__hit"
          href={pieceHref(dept, piece)}
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
