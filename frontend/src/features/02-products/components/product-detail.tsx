"use client";

import { ArrowRight, Bell, Check, Minus, PackageX, Plus, Ruler, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/commerce/product-card";
import { ProductImage } from "@/components/commerce/product-image";
import { Container } from "@/components/ui/container";
import { useCart } from "@/features/04-cart/cart-context";
import {
  formatPrice,
  useCatalog,
  useProduct,
  type ProductVariant,
} from "@/features/02-products";

export function ProductDetail({ slug }: { slug: string }) {
  const { data: product, loading } = useProduct(slug);
  /* The rest of the catalogue, for "complete the look". Read from the same store
     the listing pages use, so it costs nothing extra on a warm navigation. */
  const { data: catalogue } = useCatalog();
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState<ProductVariant["size"] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notifiedSizes, setNotifiedSizes] = useState<ProductVariant["size"][]>([]);

  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.size === selectedSize),
    [product, selectedSize],
  );

  /* The product comes from the API now, so there is a moment before the answer
     arrives. Saying "no longer live" during it would tell every visitor their
     link was dead for as long as the request took. */
  if (loading) {
    return (
      <Container as="section">
        <div className="io-empty io-tokens" aria-busy="true">
          <div className="io-empty__copy">
            <h1>Loading this piece…</h1>
          </div>
        </div>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container as="section">
        {/* Keeps an <h1>: this is the whole page, not a block inside one. */}
        <div className="io-empty io-tokens">
          <div className="io-empty__copy">
            <span className="io-empty__glyph">
              <PackageX aria-hidden size={20} strokeWidth={1.4} />
            </span>
            <h1>This edition is no longer live.</h1>
            <p>Explore the current drop for available alternatives.</p>
          </div>
          <Link className="io-btn io-btn--solid" href="/new-drop">
            See the current drop
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      </Container>
    );
  }

  const recommendations = catalogue.filter((item) => item.id !== product.id).slice(0, 3);

  return (
    <>
      <section className="pdp" aria-labelledby="product-title">
        <Container className="pdp__grid">
          {/* The photographs the piece was actually shot from, in the order an
              operator arranged them on the stock item behind this listing.

              This used to be the same source rendered twice under two invented
              labels — "Front study", "Construction detail" — because there was
              only ever one photo per product and two frames read better than
              one. Now that a piece can carry a whole run, showing it twice would
              be hiding the rest of it. The two-frame treatment survives as the
              FALLBACK, for a product nobody has photographed — now a single
              empty frame that says so. */}
          <div className="pdp__gallery" aria-label={`${product.name} media gallery`}>
            {product.images.length > 0
              ? product.images.map((src, index) => (
                  <div className={`pdp__media media-frame pdp__media--${index + 1}`} key={src}>
                    <ProductImage
                      alt={`${product.name} — view ${index + 1} of ${product.images.length}`}
                      position={product.imagePosition}
                      src={src}
                    />
                    {/* Numbered rather than named: only the operator knows what
                        each shot is of, and a label that guesses is worse than a
                        count that does not. */}
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                ))
              : /* Nobody has photographed this piece. ONE empty frame, not two:
                   the pair only ever made sense while the second was a
                   different crop of the sprite sheet, and that fallback is gone
                   — it was a picture of another garment. */
                [
                  <div className="pdp__media media-frame pdp__media--1" key="blank">
                    <ProductImage position={product.imagePosition} />
                    <span>No photograph yet</span>
                  </div>,
                ]}
          </div>

          <div className="pdp__info">
            <div className="pdp__heading">
              <p className="eyebrow">{product.collection} / {product.category}</p>
              <h1 id="product-title">{product.name}</h1>
              <div className="pdp__price">
                <strong>{formatPrice(product.price)}</strong>
                {product.compareAtPrice && <s>{formatPrice(product.compareAtPrice)}</s>}
              </div>
              <p>{product.description}</p>
            </div>

            <div className="pdp__option">
              <div className="pdp__option-heading">
                <span>Colour</span>
                <strong>{product.color}</strong>
              </div>
              <button className="colour-swatch is-selected" type="button" aria-label={`${product.color}, selected`}>
                <span style={{ background: product.variants[0]?.colorHex }} />
              </button>
            </div>

            <div className="pdp__option">
              <div className="pdp__option-heading">
                <span>Size</span>
                <button type="button"><Ruler size={15} /> Size guide</button>
              </div>
              <div className="pdp__sizes" aria-label="Choose a size">
                {product.variants.map((variant) => {
                  const soldOut = variant.stock === "SOLD_OUT";
                  return (
                    <div key={variant.id}>
                      <button
                        type="button"
                        className={selectedSize === variant.size ? "is-selected" : ""}
                        disabled={soldOut}
                        aria-label={`${variant.size}${soldOut ? ", sold out" : ""}`}
                        onClick={() => setSelectedSize(variant.size)}
                      >
                        {variant.size}
                      </button>
                      {soldOut && (
                        <button
                          className="pdp__notify-size"
                          type="button"
                          aria-label={`Notify me when size ${variant.size} is back`}
                          onClick={() => setNotifiedSizes((current) => [...new Set([...current, variant.size])])}
                        >
                          {notifiedSizes.includes(variant.size) ? <Check size={11} /> : <Bell size={11} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedVariant?.stock === "LOW_STOCK" && (
                <p className="pdp__stock" role="status">Only {selectedVariant.available} left in this size.</p>
              )}
            </div>

            <div className="pdp__buy-row">
              <div className="pdp__quantity" aria-label="Quantity">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={15} /></button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(3, value + 1))}><Plus size={15} /></button>
              </div>
              <button
                className="button button--primary pdp__add"
                type="button"
                disabled={!selectedSize}
                onClick={() => selectedSize && Array.from({ length: quantity }).forEach(() => addItem(product, selectedSize))}
              >
                {selectedSize ? "Add to bag" : "Select a size"}
                <ArrowRight size={17} />
              </button>
            </div>

            <div className="pdp__services">
              <span><Truck size={18} /> Complimentary shipping over ₹7,500</span>
              <span><ShieldCheck size={18} /> Secure checkout after customer sign in</span>
            </div>

            <div className="pdp__details">
              <details open><summary>Design story</summary><p>{product.story}</p></details>
              <details><summary>Fabric</summary><p>{product.fabric}</p></details>
              <details><summary>Care</summary><p>{product.care}</p></details>
            </div>
          </div>
        </Container>
      </section>

      {/* Dropped entirely rather than rendered as an empty grid under a heading:
          on a store with one product there is nothing to complete the look with,
          and a bare section header reads as a page that failed to load. */}
      {recommendations.length > 0 && (
        <section className="pdp-recommendations section" aria-labelledby="complete-look-heading">
          <Container>
            <div className="section-heading">
              <div><p className="eyebrow">Complete the look</p><h2 id="complete-look-heading">Keep the signal quiet.</h2></div>
            </div>
            <div className="product-grid">
              {recommendations.map((item, index) => <ProductCard product={item} index={index} key={item.id} />)}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
