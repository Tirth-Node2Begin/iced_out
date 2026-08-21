"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BottomSheet } from "@/components/nav/bottom-sheet";
import { ProductImage } from "@/components/commerce/product-image";
import { formatPrice, useProducts } from "@/features/02-products";

/** Enough to answer "is it in there", short enough to stay one glance. */
const MAX_HITS = 8;

const SUGGESTIONS = ["Hoodie", "Overshirt", "Black", "Drop 001", "After Hours", "Core Uniform"];

/**
 * Search, as a dock rather than a destination.
 *
 * The old glyph pushed the shopper to `/search`, which meant leaving whatever
 * they were reading to type a word — and coming back was their problem. This
 * opens over the page instead: the field lands on the bottom edge at full
 * width, results grow upward as the query narrows, and closing puts the
 * shopper back exactly where they were. Picking a hit is the only navigation
 * the dock ever does.
 */
export function SearchDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const matches = useProducts({ query: trimmed });
  const hits = useMemo(() => matches.slice(0, MAX_HITS), [matches]);

  /* Two pieces of state adjusted during render rather than in an effect — the
     pattern React documents for "reset when a prop changes", and the one that
     avoids a second paint showing the stale value.

     The dock stays mounted between openings so the sheet can animate out, so
     the query is cleared on the way *in*: clearing on close would visibly
     empty the results while the panel was still sliding down. */
  const [session, setSession] = useState(open);
  if (session !== open) {
    setSession(open);
    setQuery("");
    setCursor(0);
  }

  // A new query invalidates wherever the keyboard cursor was sitting.
  const [lastQuery, setLastQuery] = useState(trimmed);
  if (lastQuery !== trimmed) {
    setLastQuery(trimmed);
    setCursor(0);
  }

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  // Warm the highlighted route so the pick lands instantly — the shopper has
  // usually already decided by the time they press Enter.
  useEffect(() => {
    const hit = hits[cursor];
    if (open && hit) router.prefetch(`/product?slug=${hit.slug}`);
  }, [cursor, hits, open, router]);

  const go = (slug: string) => {
    onClose();
    router.push(`/product?slug=${slug}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (hits.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (current + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (current - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(hits[cursor].slug);
    }
  };

  return (
    <BottomSheet label="Search Iced_out" onClose={onClose} open={open}>
      <div className="io-dock__wrap">
        <div className="io-dock__field">
          <Search aria-hidden size={19} strokeWidth={1.6} />
          <label className="sr-only" htmlFor="io-dock-input">
            Search products and collections
          </label>
          <input
            autoComplete="off"
            className="io-dock__input"
            id="io-dock-input"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pieces, colours, collections"
            ref={inputRef}
            type="search"
            value={query}
          />
          <span aria-hidden className="io-dock__hint">
            Esc
          </span>
          <button aria-label="Close search" className="io-dock__close" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </div>
      </div>

      <div className="io-dock__body">
        <div className="io-dock__wrap">
          {trimmed === "" ? (
            <>
              <p className="io-dock__label">Try</p>
              <div className="io-dock__chips">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="io-dock__chip"
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          ) : hits.length > 0 ? (
            <>
              <p className="io-dock__label">
                <span>
                  {matches.length} {matches.length === 1 ? "piece" : "pieces"}
                </span>
                {matches.length > MAX_HITS && <span>Showing first {MAX_HITS}</span>}
              </p>
              {/* `aria-live` on the count above, not on the list: announcing
                  every row on every keystroke buries the one fact that changed. */}
              <ul className="io-dock__results">
                {hits.map((product, index) => (
                  <li key={product.id}>
                    <Link
                      className="io-dock__hit"
                      data-active={index === cursor}
                      href={`/product?slug=${product.slug}`}
                      onClick={onClose}
                      onMouseEnter={() => setCursor(index)}
                    >
                      <span className="io-dock__hitMedia">
                        <ProductImage
                          alt={product.name}
                          position={product.imagePosition}
                          src={product.image}
                        />
                      </span>
                      <span>
                        <span className="io-dock__hitName">{product.name}</span>
                        <span className="io-dock__hitMeta">
                          {product.category} · {product.color}
                        </span>
                      </span>
                      <span className="io-dock__hitPrice">{formatPrice(product.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="io-dock__empty">
              <strong>Nothing under “{trimmed}”.</strong>
              <p>Try a cut, a colour, or a collection name — “hoodie”, “black”, “Drop 001”.</p>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
