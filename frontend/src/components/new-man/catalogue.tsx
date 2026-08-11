"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import {
  CATALOGUE_COPY,
  MEN_PIECES,
  PAGE_SIZE,
  type Category,
  type Piece,
  type SortValue,
} from "@/components/new-man/data";
import { FilterBar } from "@/components/new-man/filter-bar";
import { ProductGrid } from "@/components/new-man/product-grid";
import { QuickAdd } from "@/components/new-man/quick-add";
import { Reveal, SplitHeading } from "@/components/new-home/motion-primitives";

/**
 * 03 — the men's catalogue: section head → sticky filter bar → product grid.
 *
 * It hangs below the hero and the editorial and changes neither; both still
 * render exactly as they did, from `DEPARTMENTS.men`.
 *
 * FILTER STATE LIVES HERE, not in the bar or the grid. The bar reports what
 * the shopper asked for and the grid draws what is left, which keeps both of
 * them presentational and means the "clear" affordances in the bar and in the
 * empty state can share one reset.
 */
export function Catalogue() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortValue>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [limit, setLimit] = useState<number>(PAGE_SIZE);
  /** the piece the quick-add panel is open on, if any */
  const [active, setActive] = useState<Piece | null>(null);

  /* Any change to the query starts the page count over — otherwise switching
     category while expanded shows a first page that is already three rows
     deep, and the "load more" affordance disappears without explanation. */
  const onCategory = useCallback((value: Category | "all") => {
    setCategory(value);
    setLimit(PAGE_SIZE);
  }, []);

  const onSort = useCallback((value: SortValue) => {
    setSort(value);
    setLimit(PAGE_SIZE);
  }, []);

  const onInStockOnly = useCallback((value: boolean) => {
    setInStockOnly(value);
    setLimit(PAGE_SIZE);
  }, []);

  const onNewOnly = useCallback((value: boolean) => {
    setNewOnly(value);
    setLimit(PAGE_SIZE);
  }, []);

  const reset = useCallback(() => {
    setCategory("all");
    setSort("featured");
    setInStockOnly(false);
    setNewOnly(false);
    setLimit(PAGE_SIZE);
  }, []);

  const visible = useMemo(() => {
    const filtered = MEN_PIECES.filter((piece) => {
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
  }, [category, sort, inStockOnly, newOnly]);

  const page = visible.slice(0, limit);
  const remaining = visible.length - page.length;

  return (
    <section className="nh-section nh-cat" id="edit">
      <div className="nh-wrap">
        <div className="nh-cat__head">
          <Reveal>
            <p className="nh-eyebrow">{CATALOGUE_COPY.eyebrow}</p>
          </Reveal>

          <SplitHeading
            className="nh-cat__title"
            segments={[...CATALOGUE_COPY.heading]}
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
          total={MEN_PIECES.length}
        />

        <ProductGrid onReset={reset} onSelect={setActive} pieces={page} />

        {remaining > 0 && (
          <div className="nh-cat__more">
            <button
              className="nh-pill nh-pill--light"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
              type="button"
            >
              Load {Math.min(remaining, PAGE_SIZE)} more
            </button>
            <p className="nh-eyebrow">
              Showing {page.length} of {visible.length}
            </p>
          </div>
        )}

        <ul className="nh-cat__notes">
          {CATALOGUE_COPY.notes.map((note) => (
            <li className="nh-cat__note" key={note.key}>
              <span className="nh-cat__noteKey">{note.key}</span>
              <span>
                <b>{note.title}</b>
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
