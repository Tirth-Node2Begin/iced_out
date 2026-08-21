"use client";

import { useSearchParams } from "next/navigation";

import { useGenderPieces } from "@/components/gender/use-pieces";
import { ProductHero } from "@/components/new-man/product-hero";
import { ProductPanels } from "@/components/new-man/product-panels";
import { ProductRelated } from "@/components/new-man/product-related";
import { ProductReviews } from "@/components/new-man/product-reviews";
import { pieceForSlug } from "@/components/new-man/product-deck";

/**
 * One men's piece, resolved from the catalogue in the browser.
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
export function PieceRoute() {
  const slug = useSearchParams().get("slug") ?? "";
  const { pieces, loading, error, loaded } = useGenderPieces("men");

  const piece = pieceForSlug(pieces, slug);

  if (piece) {
    return (
      <main className="nmp" id="main-content">
        <ProductHero piece={piece} />
        <ProductPanels piece={piece} />
        <ProductReviews piece={piece} />
        <ProductRelated piece={piece} />
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
