"use client";

import { BadgePercent, Check } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";

import { useCart } from "@/features/04-cart/cart-context";

/**
 * The coupon control, for every surface that quotes a total.
 *
 * The code lives in the cart context, not here, so entering it in the drawer
 * and then opening /cart shows one applied coupon rather than two independent
 * fields disagreeing about the price.
 */
export function CouponField() {
  const { coupon, couponError, couponPending, applyCoupon, clearCoupon } = useCart();
  const [code, setCode] = useState("");

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      // only clear the field on success — a rejected code stays put to be
      // corrected rather than retyped
      if (applyCoupon(code)) setCode("");
    },
    [applyCoupon, code],
  );

  return (
    <div className="io-coupon">
      {coupon ? (
        <div className="io-coupon__on" data-pending={couponPending ? true : undefined}>
          <span className="io-coupon__mark">
            <Check aria-hidden size={11} strokeWidth={3} />
          </span>
          <p>
            <strong>{coupon.code}</strong>
            {/* what it is doing, or what it is waiting for — never a green tick
                over a discount of nothing */}
            <span>{couponPending ?? coupon.label}</span>
          </p>
          <button className="io-coupon__off" onClick={clearCoupon} type="button">
            Remove
          </button>
        </div>
      ) : (
        <form className="io-coupon__form" onSubmit={onSubmit}>
          <label className="io-coupon__field">
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
            className="io-coupon__apply"
            disabled={code.trim().length === 0}
            type="submit"
          >
            Apply
          </button>
        </form>
      )}

      {couponError && (
        <p className="io-coupon__error" role="alert">
          {couponError}
        </p>
      )}
    </div>
  );
}
