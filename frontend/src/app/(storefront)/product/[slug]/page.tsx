import "@/styles/components/pages.css";

import { productFixtures } from "@/features/02-products";
import { ProductDetail } from "@/features/02-products/components/product-detail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}

export function generateStaticParams() {
  return productFixtures.map(({ slug }) => ({ slug }));
}
