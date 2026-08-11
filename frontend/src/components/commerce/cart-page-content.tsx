"use client";

import { ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CouponField } from "@/components/commerce/coupon-field";
import { ProductImage } from "@/components/commerce/product-image";
import { PageFrame } from "@/components/layout/page-frame";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";

/** The threshold the footer already advertises — quoted, not re-invented. */
const FREE_DELIVERY_OVER = 4999;

export function CartPageContent() {
  const router = useRouter();
  const { lines, itemCount, subtotal, coupon, discount, total, setQuantity, removeItem } =
    useCart();

  const empty = lines.length === 0;

  return (
    <PageFrame
      eyebrow="Bag"
      lede={
        empty
          ? "Nothing reserved yet. Pieces stay in the bag for this session."
          : "Sizes are held while you check out, not reserved indefinitely."
      }
      spec={
        empty
          ? undefined
          : [
              { label: "Pieces", value: String(itemCount).padStart(2, "0") },
              { label: "Subtotal", value: formatPrice(subtotal) },
            ]
      }
      title={
        <>
          Your <em>bag</em>
        </>
      }
    >
      {empty ? (
        <div className="io-empty">
          <div className="io-empty__copy">
            <span className="io-empty__glyph">
              <ShoppingBag aria-hidden size={20} strokeWidth={1.4} />
            </span>
            <h2>Your bag is empty.</h2>
            <p>
              Add a piece from the current drop and it will appear here with its size and
              price held.
            </p>
          </div>
          <Link className="io-btn io-btn--solid" href="/new-drop">
            Shop the drop
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      ) : (
        <div className="io-bag">
          <div className="io-lines">
            {lines.map((line) => (
              <article className="io-line" key={`${line.product.id}-${line.size}`}>
                <Link
                  aria-label={`View ${line.product.name}`}
                  className="io-line__media"
                  href={`/product/${line.product.slug}`}
                >
                  <ProductImage position={line.product.imagePosition} />
                </Link>

                <div className="io-line__body">
                  <h2 className="io-line__name">
                    <Link href={`/product/${line.product.slug}`}>{line.product.name}</Link>
                  </h2>

                  <p className="io-line__meta">
                    <span>{line.product.color}</span>
                    <i>/</i>
                    <span>Size {line.size}</span>
                    <i>/</i>
                    <span>{line.product.category}</span>
                  </p>

                  <div className="io-line__controls">
                    <div className="io-qty">
                      <button
                        aria-label={`Decrease ${line.product.name} quantity`}
                        onClick={() => setQuantity(line.product.id, line.size, line.quantity - 1)}
                        type="button"
                      >
                        <Minus aria-hidden size={14} />
                      </button>
                      <span aria-live="polite">{line.quantity}</span>
                      <button
                        aria-label={`Increase ${line.product.name} quantity`}
                        onClick={() => setQuantity(line.product.id, line.size, line.quantity + 1)}
                        type="button"
                      >
                        <Plus aria-hidden size={14} />
                      </button>
                    </div>

                    <button
                      className="io-link"
                      onClick={() => removeItem(line.product.id, line.size)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="io-line__side">
                  <span className="io-line__price">
                    {formatPrice(line.product.price * line.quantity)}
                  </span>
                  {/* Only where there is a genuine second number to show — the
                      unit price is noise on a line of one. */}
                  {line.quantity > 1 && (
                    <span className="io-line__was">{formatPrice(line.product.price)} each</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <aside className="io-summary">
            <h2>Summary</h2>

            <CouponField />

            <dl>
              <div>
                <dt>Pieces</dt>
                <dd>{itemCount}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="io-off">
                  <dt>{coupon?.code}</dt>
                  <dd>−{formatPrice(discount)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                {/* Stated, not guessed: the only delivery fact known here is
                    whether the order has cleared the advertised threshold.
                    Read off the merchandise subtotal, which is what the footer
                    advertises — a coupon does not un-qualify a bag. */}
                <dd>{subtotal >= FREE_DELIVERY_OVER ? "Free" : "At checkout"}</dd>
              </div>

              <div className="io-summary__total">
                <dt>Total</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            <button
              className="io-btn io-btn--solid io-btn--wide"
              onClick={() => router.push("/checkout")}
              type="button"
            >
              Secure checkout
              <ArrowRight aria-hidden size={15} />
            </button>

            <p className="io-summary__note">
              Taxes and delivery are calculated against the verified address at checkout.
              Free delivery over {formatPrice(FREE_DELIVERY_OVER)}.
            </p>
          </aside>
        </div>
      )}
    </PageFrame>
  );
}
