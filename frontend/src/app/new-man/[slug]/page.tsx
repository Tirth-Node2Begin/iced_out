import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* the detail page's own sheet — additive over new-home.css and new-man.css,
   both of which the /new-man layout above this route already loads */
import "@/styles/new-man-product.css";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/new-home/site-nav";
import { formatPrice, pricingFor } from "@/components/new-man/data";
import { ProductHero } from "@/components/new-man/product-hero";
import { ProductPanels } from "@/components/new-man/product-panels";
import { ProductRelated } from "@/components/new-man/product-related";
import { ProductReviews } from "@/components/new-man/product-reviews";
import {
  CATEGORY_LABELS,
  PRODUCT_ROUTES,
  pieceForSlug,
} from "@/components/new-man/product-deck";

type Params = { params: Promise<{ slug: string }> };

/**
 * The men's product detail page: hero → description and shipping → reviews →
 * related, then the footer.
 *
 * It is routed on the piece's NAME, not on `piece.slug`. The twenty tiles are a
 * display layer over four product fixtures, so the fixture slug is shared four
 * ways and cannot say which piece was selected; `/product/[slug]` still serves
 * those four and is untouched.
 */
export default async function ManProductPage({ params }: Params) {
  const { slug } = await params;
  const piece = pieceForSlug(slug);

  if (!piece) notFound();

  return (
    <>
      <SiteNav />
      <main className="nmp" id="main-content">
        <ProductHero piece={piece} />
        <ProductPanels piece={piece} />
        <ProductReviews />
        <ProductRelated piece={piece} />
      </main>
      <SiteFooter />
    </>
  );
}

export function generateStaticParams() {
  return PRODUCT_ROUTES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const piece = pieceForSlug(slug);

  if (!piece) return { title: "Piece not found" };

  const price = pricingFor(piece);

  return {
    title: piece.name,
    description: `${piece.name}. ${CATEGORY_LABELS[piece.category]} from Drop 001, ${formatPrice(price.price)}. Cut and finished in Bengaluru, in a single run.`,
  };
}
