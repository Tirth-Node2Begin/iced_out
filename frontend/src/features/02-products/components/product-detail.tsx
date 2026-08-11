"use client";

import { ArrowRight, Bell, Check, Minus, Plus, Ruler, ShieldCheck, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/commerce/product-card";
import { ProductImage } from "@/components/commerce/product-image";
import { Container } from "@/components/ui/container";
import { useCart } from "@/features/04-cart/cart-context";
import {
  formatPrice,
  productFixtures,
  useProduct,
  type ProductVariant,
} from "@/features/02-products";

export function ProductDetail({ slug }: { slug: string }) {
  const product = useProduct(slug);
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState<ProductVariant["size"] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notifiedSizes, setNotifiedSizes] = useState<ProductVariant["size"][]>([]);

  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.size === selectedSize),
    [product, selectedSize],
  );

  if (!product) {
    return (
      <Container className="listing-empty" as="section">
        <h1>This edition is no longer live.</h1>
        <p>Explore the current drop for available alternatives.</p>
      </Container>
    );
  }

  const recommendations = productFixtures.filter((item) => item.id !== product.id).slice(0, 3);

  return (
    <>
      <section className="pdp" aria-labelledby="product-title">
        <Container className="pdp__grid">
          <div className="pdp__gallery" aria-label={`${product.name} media gallery`}>
            {[product.imagePosition, product.imagePosition].map((position, index) => (
              <div className={`pdp__media media-frame pdp__media--${index + 1}`} key={index}>
                <ProductImage position={position} />
                <span>{index === 0 ? "Front study" : "Construction detail"}</span>
              </div>
            ))}
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
    </>
  );
}
