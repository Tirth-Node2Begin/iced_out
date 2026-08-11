"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";

/**
 * The bag, as the panel "add to bag" opens on the /new-man routes.
 *
 * `/new-man` and `/new-man/[slug]` do not use the storefront or gender headers,
 * and those headers are the only places `components/commerce/cart-drawer` is
 * mounted — so on these two routes `addItem` flipped the cart's `isOpen` to
 * true and NOTHING painted. Pressing add to bag looked like pressing nothing.
 * This is that confirmation, rebuilt against this route's own sheet: the
 * storefront drawer is styled by `chrome.css`, which /new-man deliberately does
 * not load (it also restyles `.nh-nav`, and this route's bar comes from
 * `new-home.css`).
 *
 * It is a bag, not a bag page: quantity, a coupon, and the two ways out. The
 * full bag at /cart is one press away and says so.
 */
export function BagDrawer() {
  const { isOpen } = useCart();

  return (
    <AnimatePresence>{isOpen && <BagDrawerPortal key="bag" />}</AnimatePresence>
  );
}

function BagDrawerPortal() {
  // The panel only ever exists because someone put something in the bag, so it
  // is never part of a server render and has nothing to reconcile.
  if (typeof document === "undefined") return null;
  return createPortal(<BagPanel />, document.body);
}

function BagPanel() {
  const dialog = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();

  const {
    lines,
    itemCount,
    subtotal,
    coupon,
    couponError,
    couponPending,
    discount,
    total,
    removeItem,
    setQuantity,
    applyCoupon,
    clearCoupon,
    setOpen,
  } = useCart();

  const [code, setCode] = useState("");

  const close = useCallback(() => setOpen(false), [setOpen]);

  /* --- escape, focus, and the page underneath ----------------------------- */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !dialog.current) return;

      // A modal that lets Tab wander onto the page behind it is a modal in
      // appearance only, so focus is cycled inside the panel by hand.
      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    /* Lenis drives the window scroll on these routes, so locking the document
       is what stops the page travelling behind the overlay. The scrollbar's
       width is handed back as padding or the whole layout jumps left as it
       disappears. */
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
      opener?.focus?.();
    };
  }, [close]);

  const onCoupon = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      // only clear the field on success — a rejected code stays put to be
      // corrected rather than retyped
      if (applyCoupon(code)) setCode("");
    },
    [applyCoupon, code],
  );

  /* Both ways out close the panel first. Leaving it mounted over the route it
     just pushed leaves the scroll lock on a page the shopper is now reading. */
  const leaveTo = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const empty = lines.length === 0;

  return (
    <div className="nmb" role="presentation">
      <motion.div
        animate={{ opacity: 1 }}
        className="nmb__scrim"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={close}
        transition={{ duration: 0.28, ease: EASE_OUT }}
      />

      <motion.div
        animate={{ x: 0, opacity: 1 }}
        aria-labelledby="nmb-title"
        aria-modal="true"
        className="nmb__panel"
        exit={{ x: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
        initial={{ x: reduce ? 0 : "100%", opacity: reduce ? 0 : 1 }}
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: reduce ? 0 : 0.44, ease: EASE_OUT }}
      >
        <header className="nmb__head">
          <div>
            <h2 className="nmb__title" id="nmb-title">
              Your bag
            </h2>
            <p className="nmb__count">
              {empty
                ? "Nothing reserved yet"
                : `${itemCount} ${itemCount === 1 ? "piece" : "pieces"} reserved`}
            </p>
          </div>

          <button
            aria-label="Close bag"
            className="nmb__close"
            onClick={close}
            type="button"
          >
            <X aria-hidden size={15} />
          </button>
        </header>

        {empty ? (
          <div className="nmb__empty">
            <span className="nmb__emptyGlyph">
              <ShoppingBag aria-hidden size={19} strokeWidth={1.4} />
            </span>
            <h3>Nothing on ice yet.</h3>
            <p>Add a piece from the current drop and it will be held here.</p>
            <button
              className="nmb__btn nmb__btn--solid"
              onClick={() => leaveTo("/new-man")}
              type="button"
            >
              Shop the drop
              <ArrowRight aria-hidden size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="nmb__body">
              <ul className="nmb__lines">
                {lines.map((line) => (
                  <li className="nmb__line" key={`${line.product.id}-${line.size}`}>
                    {/* the sprite sheet, restated against this panel's own class:
                        `.product-sprite` lives in commerce.css, which this route
                        does not load, and the panel is portalled out of `.nh-root`
                        anyway */}
                    <span
                      aria-hidden
                      className="nmb__thumb"
                      data-pos={line.product.imagePosition}
                    />

                    <div className="nmb__lineBody">
                      <h3 className="nmb__name">{line.product.name}</h3>
                      <p className="nmb__meta">
                        <span>{line.product.color}</span>
                        <i>/</i>
                        <span>Size {line.size}</span>
                      </p>

                      <div className="nmb__lineFoot">
                        {/* the quantity control the panel exists to offer: a
                            second of the same piece is the correction made in
                            the seconds after adding, not a trip to /cart */}
                        <div className="nmb__qty">
                          <button
                            aria-label={`Decrease ${line.product.name}, size ${line.size}`}
                            onClick={() =>
                              setQuantity(line.product.id, line.size, line.quantity - 1)
                            }
                            type="button"
                          >
                            <Minus aria-hidden size={13} />
                          </button>
                          <span aria-live="polite">{line.quantity}</span>
                          <button
                            aria-label={`Increase ${line.product.name}, size ${line.size}`}
                            onClick={() =>
                              setQuantity(line.product.id, line.size, line.quantity + 1)
                            }
                            type="button"
                          >
                            <Plus aria-hidden size={13} />
                          </button>
                        </div>

                        <button
                          className="nmb__remove"
                          onClick={() => removeItem(line.product.id, line.size)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="nmb__lineSide">
                      <span className="nmb__price">
                        {formatPrice(line.product.price * line.quantity)}
                      </span>
                      {/* only where there is a genuine second number to show —
                          the unit price is noise on a line of one */}
                      {line.quantity > 1 && (
                        <span className="nmb__each">
                          {formatPrice(line.product.price)} each
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="nmb__foot">
              {/* ------------------------------------------------- coupon */}
              <div className="nmb__coupon">
                {coupon ? (
                  <div
                    className="nmb__couponOn"
                    data-pending={couponPending ? true : undefined}
                  >
                    <span className="nmb__couponMark">
                      <Check aria-hidden size={11} strokeWidth={3} />
                    </span>
                    <p>
                      <strong>{coupon.code}</strong>
                      {/* what it is doing, or what it is waiting for — never a
                          green tick over a discount of nothing */}
                      <span>{couponPending ?? coupon.label}</span>
                    </p>
                    <button
                      className="nmb__couponOff"
                      onClick={clearCoupon}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form className="nmb__couponForm" onSubmit={onCoupon}>
                    <label className="nmb__couponField">
                      <BadgePercent aria-hidden size={14} />
                      <span className="sr-only">Coupon code</span>
                      <input
                        autoCapitalize="characters"
                        autoComplete="off"
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="Coupon code"
                        spellCheck={false}
                        value={code}
                      />
                    </label>
                    <button
                      className="nmb__couponApply"
                      disabled={code.trim().length === 0}
                      type="submit"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {couponError && (
                  <p className="nmb__couponError" role="alert">
                    {couponError}
                  </p>
                )}
              </div>

              {/* -------------------------------------------------- totals */}
              <dl className="nmb__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="nmb__totals--off">
                    <dt>{coupon?.code}</dt>
                    <dd>−{formatPrice(discount)}</dd>
                  </div>
                )}
                <div className="nmb__totals--sum">
                  <dt>Total</dt>
                  <dd>{formatPrice(total)}</dd>
                </div>
              </dl>

              <div className="nmb__actions">
                <button
                  className="nmb__btn nmb__btn--solid"
                  onClick={() => leaveTo("/checkout")}
                  type="button"
                >
                  Secure checkout
                  <ArrowRight aria-hidden size={14} />
                </button>

                {/* straight to the full bag — a Link, so it is a real
                    middle-click-able destination and not a scripted push */}
                <Link className="nmb__btn" href="/cart" onClick={close}>
                  View bag
                  <ArrowUpRight aria-hidden size={14} />
                </Link>
              </div>

              <p className="nmb__note">
                Delivery and taxes are calculated at checkout.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
