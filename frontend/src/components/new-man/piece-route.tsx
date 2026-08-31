"use client";

import { useSearchParams } from "next/navigation";

import { useGenderPieces } from "@/components/gender/use-pieces";
import { ProductHero } from "@/components/new-man/product-hero";
import { ProductPanels } from "@/components/new-man/product-panels";
import { ProductRelated } from "@/components/new-man/product-related";
import { ProductReviews } from "@/components/new-man/product-reviews";
import { DEPTS, pieceForSlug, type Dept } from "@/components/new-man/product-deck";

/**
 * One piece, resolved from the catalogue in the browser.
 *
 * `dept` is which floor it is being read on — it decides which audience the
 * catalogue is filtered to and what the breadcrumb, the back link and the
 * related tiles point at. It defaults to menswear, which is what this route
 * did before /new-woman had a detail page of its own.
 *
 * It was a `[slug]` segment whose `generateStaticParams` listed the twenty pieces
 * written into the source — so a product the console added afterwards had no page
 * at all, and one it took down still had one. The catalogue is the database now,
 * and this site is a static export, so the id moves into the query for the same
 * reason it did on every other record route here.
 *
 * The piece is still addressed by its NAME rather than by a shared fixture slug —
 * see `productSlug`. That happens to be exactly the product's own slug, because
 * both are the name slugified, so an old `/new-man/afterdark-hoodie` link and
 * `?slug=afterdark-hoodie` name the same garment.
 */
export function PieceRoute({ dept = DEPTS.men }: { dept?: Dept } = {}) {
  const slug = useSearchParams().get("slug") ?? "";
  const { pieces, loading, error, loaded } = useGenderPieces(dept.audience, {
    unisex: dept.unisex,
  });

  const piece = pieceForSlug(pieces, slug);

  if (piece) {
    return (
      <main className="nmp" id="main-content">
        <ProductHero dept={dept} piece={piece} />
        <ProductPanels piece={piece} />
        <ProductReviews dept={dept} piece={piece} />
        <ProductRelated dept={dept} piece={piece} />
      </main>
    );
  }

  /* "Reading it" is not "no such piece". Saying the second while the request is
     still out tells every visitor their link is dead for as long as it takes. */
  return (
    <main className="nmp" id="main-content">
      <div className="nh-wrap" style={{ padding: "10rem 0", textAlign: "center" }}>
        <p className="nh-eyebrow">
          {error
            ? error
            : loading || !loaded
              ? "Reading the release…"
              : "That piece is not in this release."}
        </p>
      </div>
    </main>
  );
}
