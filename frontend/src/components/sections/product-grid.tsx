"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/commerce/product-card";
import { Container } from "@/components/ui/container";
import { productFixtures } from "@/features/02-products";

const filters = ["All", "Outerwear", "Bottoms", "Essentials"] as const;
type Filter = (typeof filters)[number];

const filterIds: Record<Exclude<Filter, "All">, string[]> = {
  Outerwear: ["afterdark-hoodie", "bone-utility-overshirt"],
  Bottoms: ["shadow-cargo-02"],
  Essentials: ["core-heavy-tee"],
};

export function ProductGrid() {
  const [filter, setFilter] = useState<Filter>("All");
  const visibleProducts = useMemo(
    () =>
      filter === "All"
        ? productFixtures
        : productFixtures.filter((product) => filterIds[filter].includes(product.id)),
    [filter],
  );

  return (
    <section className="products-section section" id="new-drop" aria-labelledby="drop-heading">
      <Container>
        <div className="section-heading">
          <div>
            <p className="eyebrow">New release / 01</p>
            <h2 id="drop-heading">Built in shadow.</h2>
          </div>
          <p className="section-heading__copy">
            Four foundational pieces. Heavy fabrics, quiet details, zero excess.
          </p>
        </div>

        <div className="product-toolbar" id="shop">
          <div className="filter-pills" role="group" aria-label="Filter products">
            {filters.map((item) => (
              <button
                className={filter === item ? "is-active" : ""}
                type="button"
                key={item}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="product-count">{visibleProducts.length.toString().padStart(2, "0")} pieces</span>
        </div>

        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <ProductCard product={product} index={index} key={product.id} />
          ))}
        </div>

        <Link className="text-link products-section__link" href="/collections">
          Explore the full collection
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </Container>
    </section>
  );
}
