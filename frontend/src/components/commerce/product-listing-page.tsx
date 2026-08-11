"use client";

import { ArrowDown, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/commerce/product-card";
import { Container } from "@/components/ui/container";
import { useProducts, type ProductDestination } from "@/features/02-products";

export function ProductListingPage({
  eyebrow,
  title,
  copy,
  destination,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  destination: ProductDestination;
}) {
  const products = useProducts({ destination });
  const [sort, setSort] = useState("featured");
  const sortedProducts = useMemo(() => [...products].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : Number(b.isNew) - Number(a.isNew)), [products, sort]);
  const destinationMeta = destination === "sale" ? ["Final editions", "Computed reductions", "No restock promise"] : destination === "new-drop" ? ["Drop 001", "320 units", "Numbered release"] : ["Heavyweight forms", "Limited production", "India / worldwide"];

  return (
    <>
      <section className="listing-hero">
        <Container className="listing-hero__layout">
          <div className="listing-hero__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p><Link href="#listing-products">View the edit <ArrowDown size={16} /></Link></div>
          <div className="listing-hero__media">
            <Image src="/images/drop-001-products.avif" alt="Heavyweight black and bone pieces from the current collection" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
            <span className="listing-hero__edition">Edition 001 / Material study</span>
            <div className="listing-signal" aria-label="Collection notes">{destinationMeta.map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</div>
          </div>
        </Container>
      </section>
      <section className="listing-products" id="listing-products" aria-label={`${title} products`}>
        <Container>
          <div className="listing-toolbar">
            <p>{products.length.toString().padStart(2, "0")} pieces / live availability</p>
            <div><button type="button"><SlidersHorizontal size={14} /> Size & availability</button><label>Sort<select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option></select></label></div>
          </div>
          {products.length > 0 ? (
            <div className="listing-grid">
              {sortedProducts.map((product, index) => (
                <ProductCard product={product} index={index} key={product.id} />
              ))}
            </div>
          ) : (
            <div className="listing-empty">
              <h2>No pieces live right now.</h2>
              <p>The next signal will appear here first.</p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
