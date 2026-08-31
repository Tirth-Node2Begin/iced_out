"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  EASE_OUT,
  Reveal,
  SplitHeading,
} from "@/components/new-home/motion-primitives";
import {
  pageRun,
  spellCount,
  type Category,
  type Piece,
  type SortValue,
} from "@/components/gender/data";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { shippingNote } from "@/components/new-man/product-deck";
import { QuickAdd } from "@/components/new-man/quick-add";
import { EDIT_COPY, PAGE_SIZE } from "@/components/new-woman/data";
import { FilterRail } from "@/components/new-woman/filter-rail";
import { PieceCard } from "@/components/new-woman/piece-card";
import { useStorefrontConfig } from "@/features/04-cart/storefront-config";

/**
 * 03 — the women's edit: section head → filter rail → grid → pager → notes.
 *
 * The PIECES come from the database — every published product whose audience is
 * `women` or `unisex`, read through the same hook /new-man and /new-drop read
 * theirs with. Publish something in `/admin/catalog` and it appears here;
 * reprice it there and the tile says the new price.
 *
 * FILTER STATE LIVES HERE, not in the rail or the grid. The rail reports what
 * the shopper asked for and the grid draws what is left, which keeps both of
 * them presentational and means the rail's "clear" and the empty state's can
 * share exactly one reset.
 *
 * The QUICK-ADD is the men's panel, unchanged. It is a catalogue control rather
 * than a department one — it picks a size and puts a real line in the shared
 * cart — and a second copy of it here would be a second place for the size run
 * and the free-delivery threshold to go stale.
 */
export function WomanEdit() {
  /* Womenswear only. `unisex: false` is what makes this an edit rather than a
     second view of the same catalogue — see `useGenderPieces`. */
  const { pieces, loading, error } = useGenderPieces("women", { unisex: false });
  /* The threshold the shop actually applies — note 02 advertises it, and a
     hardcoded copy of it is a promise that goes stale. */
  const { freeDeliveryOver } = useStorefrontConfig();

  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortValue>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  /** 1-based, so it reads the same here as it does on the buttons */
  const [pageIndex, setPageIndex] = useState(1);
  /** the piece the quick-add panel is open on, if any */
  const [active, setActive] = useState<Piece | null>(null);

  /* The top of the grid, so paging can put the shopper back at the first tile.
     Anchored above the grid rather than on it: the target has to sit at a
     position that does not depend on what the grid is currently drawing. */
  const gridTop = useRef<HTMLDivElement>(null);

  /* Any change to the query starts over at page one — otherwise narrowing to a
     category with four pieces while page two is open leaves the shopper on a
     page that no longer exists. */
  const onCategory = useCallback((value: Category | "all") => {
    setCategory(value);
    setPageIndex(1);
  }, []);

  const onSort = useCallback((value: SortValue) => {
    setSort(value);
    setPageIndex(1);
  }, []);

  const onInStockOnly = useCallback((value: boolean) => {
    setInStockOnly(value);
    setPageIndex(1);
  }, []);

  const onNewOnly = useCallback((value: boolean) => {
    setNewOnly(value);
    setPageIndex(1);
  }, []);

  const reset = useCallback(() => {
    setCategory("all");
    setSort("featured");
    setInStockOnly(false);
    setNewOnly(false);
    setPageIndex(1);
  }, []);

  /* Paging is a jump, not a scroll — the tiles it lands on are above the
     control that was pressed, so leaving the viewport where it was would show
     the shopper the notes under a grid they never saw change. Instant rather
     than smooth: Lenis drives this route, and a native smooth scroll runs
     against its animation instead of with it. */
  const goToPage = useCallback((next: number) => {
    setPageIndex(next);
    gridTop.current?.scrollIntoView({ block: "start" });
  }, []);

  const visible = useMemo(() => {
    const filtered = pieces.filter((piece) => {
      if (category !== "all" && piece.category !== category) return false;
      if (inStockOnly && piece.soldOut) return false;
      if (newOnly && !piece.isNew) return false;
      return true;
    });

    // `featured` is the authored order, so it is the one sort that does nothing
    if (sort === "featured") return filtered;

    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      return Number(Boolean(b.isNew)) - Number(Boolean(a.isNew));
    });
  }, [pieces, category, sort, inStockOnly, newOnly]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  /* Clamped where it is read rather than corrected in an effect: the filtered
     set can shrink under an open page, and an effect would let the grid paint
     the empty page once before putting it right. */
  const current = Math.min(pageIndex, pageCount);
  const from = (current - 1) * PAGE_SIZE;
  const page = visible.slice(from, from + PAGE_SIZE);

  return (
    <section className="nw-edit" id="nw-edit">
      <div className="nh-wrap">
        <div className="nw-edit__head">
          <div>
            <Reveal>
              <p className="nw-kicker">{EDIT_COPY.eyebrow}</p>
            </Reveal>

            {/* The count is the release, spelled out — this is a sentence, and
                a number belongs in one as a word. It is the live count, not a
                figure typed into the deck. */}
            <SplitHeading
              className="nw-edit__title"
              segments={EDIT_COPY.heading.map((segment) => ({
                ...segment,
                text: segment.text.replace(
                  "{count}",
                  spellCount(pieces.length),
                ),
              }))}
            />
          </div>

          <Reveal className="nw-edit__headMeta" delay={0.1}>
            {/* The live tally. Keyed on the number so the digits swap rather
                than silently rewriting themselves — a filter that changes
                nothing visible is a filter a shopper thinks is broken. */}
            <span aria-live="polite" className="nw-edit__headCount">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={visible.length}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                >
                  {String(visible.length).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
              <span> / {String(pieces.length).padStart(2, "0")} pieces</span>
            </span>
            <span className="nh-eyebrow">{EDIT_COPY.right}</span>
          </Reveal>
        </div>

        <FilterRail
          category={category}
          inStockOnly={inStockOnly}
          newOnly={newOnly}
          onCategory={onCategory}
          onInStockOnly={onInStockOnly}
          onNewOnly={onNewOnly}
          onReset={reset}
          onSort={onSort}
          sort={sort}
        />

        <div className="nw-edit__gridTop" ref={gridTop} />

        {/* Three nothings, told apart. An empty grid while the catalogue is in
            flight is indistinguishable from a shop with nothing in it, and so
            is one whose request failed. */}
        {pieces.length === 0 && (loading || error) ? (
          <p className="nh-eyebrow" role="status">
            {error ?? "Reading the release…"}
          </p>
        ) : page.length === 0 ? (
          <div className="nw-grid__empty">
            <p className="nh-display nw-grid__emptyTitle">
              {EDIT_COPY.emptyTitle}
            </p>
            <p className="nh-body">{EDIT_COPY.emptyBody}</p>
            <button
              className="nw-btn nw-btn--ghost"
              onClick={reset}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="nw-grid">
            {page.map((piece, index) => (
              <PieceCard
                index={index}
                key={piece.id}
                number={from + index + 1}
                onSelect={setActive}
                piece={piece}
              />
            ))}
          </div>
        )}

        {/* One page of results needs no pager — the row would be a single lit
            button with nothing to travel to. */}
        {pageCount > 1 && (
          <nav aria-label="Edit pages" className="nw-pager">
            {/* Prev, the numbers and Next travel as one group. Left loose in
                the row, `space-between` spread all four children across the
                full width and put half a screen between Next and the tally it
                belongs to. */}
            <div className="nw-pager__row">
              <button
                className="nw-pager__step"
                disabled={current === 1}
                onClick={() => goToPage(current - 1)}
                type="button"
              >
                Prev
              </button>

              <ul className="nw-pager__pages">
                {pageRun(current, pageCount).map((entry, index) =>
                  entry === "gap" ? (
                    /* Keyed by position: a run can hold two gaps, and the marker
                     carries nothing to tell them apart. */
                    <li
                      aria-hidden
                      className="nw-pager__gap"
                      key={`gap-${index}`}
                    >
                      &hellip;
                    </li>
                  ) : (
                    <li key={entry}>
                      <button
                        aria-current={entry === current ? "page" : undefined}
                        aria-label={`Page ${entry}`}
                        className="nw-pager__page"
                        data-on={entry === current ? "" : undefined}
                        onClick={() => goToPage(entry)}
                        type="button"
                      >
                        {String(entry).padStart(2, "0")}
                      </button>
                    </li>
                  ),
                )}
              </ul>

              <button
                className="nw-pager__step"
                disabled={current === pageCount}
                onClick={() => goToPage(current + 1)}
                type="button"
              >
                Next
              </button>
            </div>

            {/* Announced, because the grid above changes without the page
                navigating and a screen reader would otherwise get no word. */}
            <p className="nh-eyebrow nw-pager__count" role="status">
              Showing {from + 1}&ndash;{from + page.length} of {visible.length}
            </p>
          </nav>
        )}

        <ul className="nw-notes">
          {EDIT_COPY.notes.map((note) => (
            <li className="nw-note" key={note.key}>
              <span className="nw-note__key">{note.key}</span>
              {/* Note 02 carries no title of its own: it advertises the
                  free-delivery threshold, which is a setting rather than copy. */}
              <h3 className="nw-note__title">
                {note.title || shippingNote(freeDeliveryOver)}
              </h3>
              <p className="nw-note__body">{note.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Keyed on the piece so switching tiles without closing re-runs the
          panel's own entrance rather than silently swapping its contents. */}
      <AnimatePresence>
        {active && (
          <QuickAdd
            key={active.id}
            onClose={() => setActive(null)}
            piece={active}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
