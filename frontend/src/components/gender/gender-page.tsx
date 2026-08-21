"use client";

import { useMemo, useState } from "react";

import { BrandStory } from "@/components/gender/brand-story";
import type {
  AudienceContent,
  Category,
  Piece,
  SortValue,
} from "@/components/gender/data";
import { FilterBar } from "@/components/gender/filter-bar";
import { GenderHero } from "@/components/gender/hero";
import { CollectionIntro } from "@/components/gender/intro";
import { LifestyleBanner } from "@/components/gender/lifestyle-banner";
import { Lookbook } from "@/components/gender/lookbook";
import { ProductShelf } from "@/components/gender/product-grid";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The /new-drop and /women experience. Both routes render this with a different
 * `content` deck — every string and editorial crop comes from
 * `@/components/gender/data`, so the two surfaces stay structurally identical and
 * diverge only in what they say.
 *
 * The PIECES do not. They are the published catalogue for this audience, read from
 * the database (`useGenderPieces`). They used to be twenty hardcoded objects per
 * page, thirty-six of the forty standing for products that did not exist — every
 * one of them linking to one of four real slugs, so a tile could advertise a price
 * the page it opened disagreed with.
 *
 * The section order is the brief, and the grids are deliberately interleaved
 * with the editorial blocks rather than stacked:
 *
 *   hero → introduction → [ filter rail | grid · band · grid · lookbook · grid ]
 *        → brand story → footer
 *
 * The bracketed part is `.gx-edit`, a two-column grid: the filter rail holds
 * column one and spans every row, which is what lets `position: sticky` keep
 * it beside the grids for exactly as long as the edit runs.
 *
 * FILTER STATE LIVES HERE, not in the shelves. The rail governs all three
 * grids, so no single shelf can own it.
 */
export function GenderPage({ content }: { content: AudienceContent }) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortValue>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);

  /* The catalogue, narrowed to this page's audience. `unisex` counts as both. */
  const { pieces, loading, error, loaded } = useGenderPieces(content.audience);

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

  /**
   * The three shelves split whatever the filter left rather than each querying
   * the catalogue. Dealing round-robin (not slicing 8/6/rest) is what keeps a
   * narrow filter — "Accessories" leaves four pieces — from filling the first
   * shelf and emptying the other two.
   */
  const shelves = useMemo(() => dealAcross(visible, 3), [visible]);

  return (
    <div className="gx-root">
      <main id="main-content">
        {/* 01 ------------------------------------------ full-screen hero */}
        <GenderHero content={content} />

        {/* 02 ------------------------------------ collection introduction */}
        <CollectionIntro content={content} count={pieces.length} />

        {/* 03–08 ------- the edit: sticky filter rail beside the grids ---- */}
        <div className="gx-edit">
          <FilterBar
            category={category}
            inStockOnly={inStockOnly}
            newOnly={newOnly}
            onCategory={setCategory}
            onInStockOnly={setInStockOnly}
            onNewOnly={setNewOnly}
            onReset={() => {
              setCategory("all");
              setSort("featured");
              setInStockOnly(false);
              setNewOnly(false);
            }}
            onSort={setSort}
            shown={visible.length}
            sort={sort}
            total={pieces.length}
          />

          {/* premium 4-column grid. The first shelf carries the read's state, so a
              page with nothing on it says whether that is a quiet catalogue, a
              request still in flight, or one that failed. */}
          <ProductShelf
            {...content.shelves[0]}
            columns={4}
            emptyNote={
              error
                ? error
                : loading && !loaded
                  ? "Reading the release…"
                  : pieces.length === 0
                    ? "Nothing is published for this release yet."
                    : undefined
            }
            pieces={shelves[0]}
          />

          {/* the two editorial blocks break the rail's column to run full width */}
          <LifestyleBanner content={content} />

          <ProductShelf {...content.shelves[1]} columns={3} pieces={shelves[1]} wide />

          <Lookbook content={content} />

          <ProductShelf {...content.shelves[2]} columns={4} pieces={shelves[2]} />
        </div>

        {/* 09 -------------------------------------- brand story banner */}
        <BrandStory content={content} />
      </main>

      {/* 10 ------------------------------------------------------ footer */}
      <SiteFooter />
    </div>
  );
}

/** Deal the pieces round-robin so every shelf keeps a share of whatever the
 *  filter left, and none collapses to empty while another overflows. */
function dealAcross(pieces: Piece[], buckets: number): Piece[][] {
  const out: Piece[][] = Array.from({ length: buckets }, () => []);
  pieces.forEach((piece, index) => out[index % buckets].push(piece));
  return out;
}
