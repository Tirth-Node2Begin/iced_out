"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { shippingNote } from "@/components/new-man/product-deck";
import { useStorefrontConfig } from "@/features/04-cart/storefront-config";
import {
  CATALOGUE_COPY,
  PAGE_SIZE,
  type Category,
  type Piece,
  type SortValue,
} from "@/components/new-man/data";
import { spellCount } from "@/components/gender/data";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { FilterBar } from "@/components/new-man/filter-bar";
import { ProductGrid } from "@/components/new-man/product-grid";
import { QuickAdd } from "@/components/new-man/quick-add";
import { Reveal, SplitHeading } from "@/components/new-home/motion-primitives";

/**
 * The run of page numbers to draw: always the first and the last, always the
 * current one and its two neighbours, and a single gap marker standing in for
 * whatever falls between. Seventeen pieces is three pages, so nothing is
 * elided today — the window is here because the catalogue is a thing an
 * operator adds to, and a bar that grows one button per page stops fitting.
 */
function pageRun(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const wanted = [1, count, current - 1, current, current + 1].filter(
    (n) => n >= 1 && n <= count,
  );
  const pages = [...new Set(wanted)].sort((a, b) => a - b);

  const run: Array<number | "gap"> = [];
  pages.forEach((n, i) => {
    const prev = pages[i - 1];
    if (i > 0 && n - prev > 1) {
      /* A gap of exactly one is not worth a marker — "1 … 3" costs the same
         width as "1 2 3" and hides a page instead of offering it. */
      run.push(n - prev === 2 ? prev + 1 : "gap");
    }
    run.push(n);
  });
  return run;
}

/**
 * 03 — the men's catalogue: section head → sticky filter bar → product grid.
 *
 * It hangs below the hero and the editorial and changes neither; both still
 * render exactly as they did, from `DEPARTMENTS.men`.
 *
 * The PIECES come from the database — every published product whose audience is
 * `men` or `unisex`. They used to be `MEN_PIECES`, twenty objects written into
 * `components/gender/data.ts`, which meant this page could not see a product the
 * console had added and went on showing one the console had moved to Draft.
 * `/new-drop` and `/women` were converted first; this surface renders its own
 * section deck rather than importing theirs, so it kept its own copy of the list.
 *
 * FILTER STATE LIVES HERE, not in the bar or the grid. The bar reports what
 * the shopper asked for and the grid draws what is left, which keeps both of
 * them presentational and means the "clear" affordances in the bar and in the
 * empty state can share one reset.
 */
export function Catalogue() {
  const { pieces, loading, error } = useGenderPieces("men");
  /* The free-delivery threshold the shop actually applies — note 02 below
     advertises it, and a hardcoded copy of it is a promise that goes stale. */
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
     category with five pieces while page three is open leaves the shopper on a
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
     control that was clicked, so leaving the viewport where it was would show
     the shopper the notes under a grid they never saw change. Instant rather
     than smooth: Lenis is driving this route, and a native smooth scroll runs
     against its own animation instead of with it. */
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
    <section className="nh-section nh-cat" id="edit">
      <div className="nh-wrap">
        <div className="nh-cat__head">
          <Reveal>
            <p className="nh-eyebrow">{CATALOGUE_COPY.eyebrow}</p>
          </Reveal>

          {/* The count is the release, spelled out. It was written into the
              sentence as "Twenty", which stopped being true the moment the
              catalogue became something an operator could add to. */}
          <SplitHeading
            className="nh-cat__title"
            segments={CATALOGUE_COPY.heading.map((segment) => ({
              ...segment,
              text: segment.text.replace("{count}", spellCount(pieces.length)),
            }))}
          />

          <Reveal delay={0.1}>
            <p className="nh-eyebrow nh-cat__headRight">
              {CATALOGUE_COPY.right}
            </p>
          </Reveal>
        </div>

        <FilterBar
          category={category}
          inStockOnly={inStockOnly}
          newOnly={newOnly}
          onCategory={onCategory}
          onInStockOnly={onInStockOnly}
          onNewOnly={onNewOnly}
          onReset={reset}
          onSort={onSort}
          shown={visible.length}
          sort={sort}
          total={pieces.length}
        />

        <div ref={gridTop} className="nh-cat__gridTop" />

        {/* Three nothings, told apart. An empty grid while the catalogue is in
            flight is indistinguishable from a shop with nothing in it, and so is
            one whose request failed. */}
        {pieces.length === 0 && (loading || error) ? (
          <p className="nh-eyebrow" role="status">
            {error ?? "Reading the release…"}
          </p>
        ) : (
          <ProductGrid onReset={reset} onSelect={setActive} pieces={page} />
        )}

        {/* One page of results needs no pager — the bar would be a row of a
            single lit button with nothing to travel to. */}
        {pageCount > 1 && (
          <nav aria-label="Catalogue pages" className="nh-cat__pager">
            <div className="nh-cat__pagerRow">
              <button
                className="nh-cat__step"
                disabled={current === 1}
                onClick={() => goToPage(current - 1)}
                type="button"
              >
                Prev
              </button>

              <ul className="nh-cat__pages">
                {pageRun(current, pageCount).map((entry, i) =>
                  entry === "gap" ? (
                    /* Keyed by position: a run can hold two gaps, and the
                       marker itself carries nothing to tell them apart. */
                    <li aria-hidden className="nh-cat__gap" key={`gap-${i}`}>
                      &hellip;
                    </li>
                  ) : (
                    <li key={entry}>
                      <button
                        aria-current={entry === current ? "page" : undefined}
                        aria-label={`Page ${entry}`}
                        className="nh-cat__page"
                        data-on={entry === current ? "" : undefined}
                        onClick={() => goToPage(entry)}
                        type="button"
                      >
                        {entry}
                      </button>
                    </li>
                  ),
                )}
              </ul>

              <button
                className="nh-cat__step"
                disabled={current === pageCount}
                onClick={() => goToPage(current + 1)}
                type="button"
              >
                Next
              </button>
            </div>

            {/* Announced, because the grid above it changes without the page
                navigating and a screen reader would otherwise get no word of
                it. */}
            <p className="nh-eyebrow" role="status">
              Showing {from + 1}&ndash;{from + page.length} of {visible.length}
            </p>
          </nav>
        )}

        <ul className="nh-cat__notes">
          {CATALOGUE_COPY.notes.map((note) => (
            <li className="nh-cat__note" key={note.key}>
              <span className="nh-cat__noteKey">{note.key}</span>
              <span>
                {/* Note 02 carries no title of its own: it advertises the
                    free-delivery threshold, which is a setting rather than
                    copy. */}
                <b>{note.title || shippingNote(freeDeliveryOver)}</b>
                <span className="nh-body">{note.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* keyed on the piece so switching tiles without closing re-runs the
          panel's own entrance rather than silently swapping its contents */}
      <AnimatePresence>
        {active && (
          <QuickAdd key={active.id} onClose={() => setActive(null)} piece={active} />
        )}
      </AnimatePresence>
    </section>
  );
}
