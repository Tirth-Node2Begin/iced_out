"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react";
import Link from "next/link";

import { CouponField } from "@/components/commerce/coupon-field";
import { ProductImage } from "@/components/commerce/product-image";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";
import { useCheckoutModal } from "@/features/04-cart/checkout-modal-context";

/**
 * The confirmation "add to bag" opens.
 *
 * It is the only proof the piece landed, so it states what landed and what it
 * costs, and then offers the two things there are to do next — open the bag, or
 * check out. It deliberately does not try to be the bag page: quantity and
 * removal are here because they are the corrections you make in the second
 * after adding, and nothing else is.
 */
export function CartDrawer() {
  const { openCheckout } = useCheckoutModal();
  const { lines, isOpen, itemCount, subtotal, coupon, discount, total, removeItem, setQuantity, setOpen } =
    useCart();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="io-drawer__overlay" />
        <Dialog.Content className="io-drawer">
          <div className="io-drawer__head">
            <div>
              <Dialog.Title className="io-drawer__title">Your bag</Dialog.Title>
              <Dialog.Description className="io-drawer__note">
                {itemCount === 0
                  ? "Nothing reserved yet"
                  : `${itemCount} ${itemCount === 1 ? "piece" : "pieces"} reserved`}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close bag" className="io-drawer__close">
              <X aria-hidden size={18} />
            </Dialog.Close>
          </div>

          {lines.length === 0 ? (
            <div className="io-drawer__body">
              <div className="io-empty">
                <div className="io-empty__copy">
                  <span className="io-empty__glyph">
                    <ShoppingBag aria-hidden size={19} strokeWidth={1.4} />
                  </span>
                  <h2>Nothing on ice yet.</h2>
                  <p>Add a piece from the current drop and it will be held here.</p>
                </div>
                <Dialog.Close asChild>
                  <Link className="io-btn io-btn--solid" href="/new-drop">
                    Shop the drop
                    <ArrowRight aria-hidden size={15} />
                  </Link>
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <>
              <div className="io-drawer__body">
                <div className="io-lines">
                  {lines.map((line) => (
                    <article className="io-line" key={`${line.product.id}-${line.size}`}>
                      <span className="io-line__media">
                        <ProductImage
                          alt={line.product.name}
                          position={line.product.imagePosition}
                          src={line.product.image}
                        />
                      </span>

                      <div className="io-line__body">
                        <h3 className="io-line__name">{line.product.name}</h3>
                        <p className="io-line__meta">
                          <span>{line.product.color}</span>
                          <i>/</i>
                          <span>Size {line.size}</span>
                        </p>

                        <div className="io-line__controls">
                          <div className="io-qty">
                            <button
                              aria-label={`Decrease ${line.product.name} quantity`}
                              onClick={() =>
                                setQuantity(line.product.id, line.size, line.quantity - 1)
                              }
                              type="button"
                            >
                              <Minus aria-hidden size={14} />
                            </button>
                            <span aria-live="polite">{line.quantity}</span>
                            <button
                              aria-label={`Increase ${line.product.name} quantity`}
                              onClick={() =>
                                setQuantity(line.product.id, line.size, line.quantity + 1)
                              }
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
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="io-drawer__foot">
                <CouponField />

                <div className="io-drawer__row">
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>

                {discount > 0 && (
                  <div className="io-drawer__row io-drawer__row--off">
                    <span>{coupon?.code}</span>
                    <strong>−{formatPrice(discount)}</strong>
                  </div>
                )}

                {discount > 0 && (
                  <div className="io-drawer__row">
                    <span>Total</span>
                    <strong>{formatPrice(total)}</strong>
                  </div>
                )}

                <button
                  className="io-btn io-btn--solid io-btn--wide"
                  onClick={() => {
                    /* The drawer goes first. Two stacked surfaces both holding
                       a scroll lock is one of them getting it wrong on close. */
                    setOpen(false);
                    openCheckout();
                  }}
                  type="button"
                >
                  Secure checkout
                  <ArrowRight aria-hidden size={15} />
                </button>

                <Dialog.Close asChild>
                  <Link className="io-btn io-btn--ghost io-btn--wide" href="/cart">
                    View bag
                  </Link>
                </Dialog.Close>

                <p className="io-summary__note">
                  Delivery and taxes are calculated at checkout.
                </p>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
