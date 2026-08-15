import "@/styles/components/pages.css";

import type { Metadata } from "next";

import { getProduct, productFixtures } from "@/features/02-products";
import { ProductDetail } from "@/features/02-products/components/product-detail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}

export function generateStaticParams() {
  return productFixtures.map(({ slug }) => ({ slug }));
}

/* The piece's own name in the tab — with twenty numbered products open across a
   dozen tabs, "Iced Out • Product" would tell a shopper nothing. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);

  return { title: product?.name ?? "Product" };
}
