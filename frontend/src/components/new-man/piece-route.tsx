"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

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
  const router = useRouter();
  const slug = useSearchParams().get("slug") ?? "";
  const { pieces, loading, error, loaded } = useGenderPieces(dept.audience, {
    unisex: dept.unisex,
  });

  const piece = pieceForSlug(pieces, slug);

  /* A slug that names nothing is not a screen of its own. Once the catalogue has
     actually answered — `loaded` and not still in flight — an unresolvable `?slug=`
     hands the shopper back to the department listing rather than parking them on a
     dead-end notice. `replace` rather than `push` so Back returns to wherever the
     bad link was followed from instead of bouncing off this route again.

     Guarded on `error` too: a failed read is "we could not check", not "no such
     piece", and redirecting on it would hide the outage behind a silent bounce. */
  const missing = loaded && !loading && !error && !piece;

  useEffect(() => {
    if (missing) router.replace(dept.base);
  }, [dept.base, missing, router]);

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

  /* The redirect above is already running — there is nothing to say while the
     route is leaving, and the notice that used to sit here is exactly what made
     `?slug=<anything>` look like a page of its own. */
  if (missing) return null;

  /* "Reading it" is not "no such piece". Saying the second while the request is
     still out tells every visitor their link is dead for as long as it takes. */
  return (
    <main className="nmp" id="main-content">
      <div className="nh-wrap" style={{ padding: "10rem 0", textAlign: "center" }}>
        <p className="nh-eyebrow">{error ?? "Reading the release…"}</p>
      </div>
    </main>
  );
}
