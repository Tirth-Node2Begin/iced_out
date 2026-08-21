"use client";

import { Heart, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProductImage } from "@/components/commerce/product-image";
import { useCart } from "@/features/04-cart/cart-context";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { formatPrice, type Product } from "@/features/02-products";

export function ProductCard({ product }: { product: Product; index: number }) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const { addItem } = useCart();
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.id);

  return (
    <article className="product-card">
      <div className="product-card__media media-frame">
        <Link
          className="product-card__media-link"
          href={`/product?slug=${product.slug}`}
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            alt={product.name}
            position={product.imagePosition}
            src={product.image}
          />
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button
          className="wishlist-button"
          type="button"
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
          aria-pressed={saved}
          onClick={() => toggle(product.id)}
        >
          <Heart aria-hidden="true" fill={saved ? "currentColor" : "none"} size={18} />
        </button>

        <div className="product-card__quick-add">
          <div className="size-picker" aria-label={`Choose a size for ${product.name}`}>
            {product.variants.map((variant) => {
              const isSoldOut = variant.stock === "SOLD_OUT";
              return (
                <button
                  type="button"
                  key={variant.id}
                  disabled={isSoldOut}
                  className={selectedSize === variant.size ? "is-selected" : ""}
                  aria-label={`${variant.size}${isSoldOut ? ", sold out" : ""}`}
                  onClick={() => setSelectedSize(variant.size)}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
          <button
            className="quick-add-button"
            type="button"
            disabled={!selectedSize}
            onClick={() => selectedSize && addItem(product, selectedSize)}
          >
            {selectedSize ? "Add to bag" : "Select a size"}
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="product-card__details">
        <div>
          <p>{product.category}</p>
          <h3><Link href={`/product?slug=${product.slug}`}>{product.name}</Link></h3>
          <span>{product.color}</span>
        </div>
        <div className="product-price">
          <strong>{formatPrice(product.price)}</strong>
          {product.compareAtPrice && <s>{formatPrice(product.compareAtPrice)}</s>}
        </div>
      </div>
    </article>
  );
}
