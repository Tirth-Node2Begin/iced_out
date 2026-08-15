import "@/styles/components/pages.css";

import type { Metadata } from "next";

import { ProductListingPage } from "@/components/commerce/product-listing-page";

const names: Record<string, string> = {
  "drop-001": "Drop 001",
  "after-hours": "After Hours",
  "core-uniform": "Core Uniform",
};

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = names[slug] ?? "Collection";

  return (
    <ProductListingPage
      eyebrow="Iced_out / Collection"
      title={`${name}.`}
      copy="One chapter, built to layer together and released in limited numbers."
      destination={`collection:${slug}`}
    />
  );
}

export function generateStaticParams() {
  return Object.keys(names).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: names[slug] ?? "Collection" };
}
