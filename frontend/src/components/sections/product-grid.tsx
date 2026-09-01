"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/commerce/product-card";
import { Container } from "@/components/ui/container";
import { useCatalog } from "@/features/02-products";

const ALL = "All";

export function ProductGrid() {
  const [filter, setFilter] = useState<string>(ALL);
  const { data: products, loading, error, loaded } = useCatalog();

  /**
   * The pills, read off the catalogue rather than declared.
   *
   * This used to be a fixed list of four labels and a map of the product ids
   * under each — so a category added in the console never got a pill, and a
   * product created there was filed under none of them and vanished from every
   * tab but "All". The categories on screen are now whichever ones the published
   * products actually carry, in catalogue order.
   */
  const filters = useMemo(() => {
    const seen: string[] = [];

    for (const product of products) {
      if (product.taxonomy && !seen.includes(product.taxonomy)) seen.push(product.taxonomy);
    }

    /* One category is not a choice — the pills only earn their space when there
       is something to switch between. */
    return seen.length > 1 ? [ALL, ...seen] : [];
  }, [products]);

  /* A pill can disappear under the cursor — a category renamed in the console,
     or the last product in it unpublished. Falling back to "All" shows the
     catalogue instead of an empty grid under a selection that no longer exists. */
  const active = filters.includes(filter) ? filter : ALL;

  const visibleProducts = useMemo(
    () =>
      active === ALL ? products : products.filter((product) => product.taxonomy === active),
    [active, products],
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
            Heavy fabrics, quiet details, zero excess.
          </p>
        </div>

        <div className="product-toolbar" id="shop">
          {filters.length > 0 && (
            <div className="filter-pills" role="group" aria-label="Filter products">
              {filters.map((item) => (
                <button
                  className={active === item ? "is-active" : ""}
                  type="button"
                  key={item}
                  aria-pressed={active === item}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <span className="product-count">{visibleProducts.length.toString().padStart(2, "0")} pieces</span>
        </div>

        {/* Three states, said out loud. A grid that renders nothing while the
            catalogue is in flight is indistinguishable from a shop with nothing
            in it, and so is one whose request failed. */}
        {loading && !loaded ? (
          <p className="product-count" role="status">Loading the drop…</p>
        ) : error ? (
          <p className="product-count" role="status">{error}</p>
        ) : visibleProducts.length === 0 ? (
          <p className="product-count" role="status">Nothing is live in this release yet.</p>
        ) : (
          <div className="product-grid">
            {visibleProducts.map((product, index) => (
              <ProductCard product={product} index={index} key={product.id} />
            ))}
          </div>
        )}

        <Link className="text-link products-section__link" href="/new-drop">
          Explore the full collection
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </Container>
    </section>
  );
}
