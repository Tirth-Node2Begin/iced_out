"use client";

import { ArrowRight, Clock3, Hash, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ProductCard } from "@/components/commerce/product-card";
import { Container } from "@/components/ui/container";
import { useProducts } from "@/features/02-products";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const products = useProducts({ query });

  return (
    <section className="search-results-page">
      <Container>
        <div className="search-discovery-strip">
          <span><Sparkles size={14} /> Discovery terminal</span>
          <div><Link href="/search?q=hoodie">Heavyweight hoodies</Link><Link href="/search?q=black">All black</Link><Link href="/collections/view?slug=drop-001">Drop 001</Link></div>
          <small><Clock3 size={13} /> Index refreshed now</small>
        </div>
        <form className="search-results-page__form" action="/search">
          <Search aria-hidden="true" size={21} />
          <label className="sr-only" htmlFor="search-results-query">Search products and collections</label>
          <input id="search-results-query" name="q" defaultValue={query} placeholder="Search the current signal" type="search" />
          <button className="button button--primary" type="submit">Search</button>
        </form>

        <div className="search-results-page__heading">
          <p className="eyebrow">Search / {products.length.toString().padStart(2, "0")} results</p>
          <h1>{query ? `Results for “${query}”.` : "Search Iced_out."}</h1>
          <div className="search-query-notes"><span><Hash size={13} /> Cut, colour, or collection</span><p>The index looks across live pieces and current editions. Availability is checked again when a size is selected.</p></div>
        </div>

        {products.length ? (
          <div className="listing-grid">
            {products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}
          </div>
        ) : (
          <div className="io-empty io-tokens">
            <div className="io-empty__copy">
              <span className="io-empty__glyph">
                <Search aria-hidden size={20} strokeWidth={1.4} />
              </span>
              <h2>No exact signal found.</h2>
              <p>Try “hoodie”, “black”, or a collection name—or return to the current drop.</p>
            </div>
            <Link className="io-btn io-btn--solid" href="/new-drop">
              Browse New Drop
              <ArrowRight aria-hidden size={15} />
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
