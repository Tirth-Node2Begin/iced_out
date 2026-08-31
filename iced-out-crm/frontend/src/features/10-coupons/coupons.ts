/**
 * The codes the bag will accept.
 *
 * This is a FRONTEND FIXTURE, in the same spirit as `productFixtures`: there is
 * no orders API yet, so the discount a shopper sees while they shop has to come
 * from somewhere, and a bag that silently ignores every code is worse than one
 * that quotes a rule it can state. `AFTERDARK15` is the same code and the same
 * rule the admin coupon builder ships as its default, so the two surfaces are
 * not describing different promotions.
 *
 * The real total is still the API's to compute at checkout — nothing here is a
 * price guarantee, and `checkout-step-page` says so where it matters.
 */

export type Coupon = {
  /** stored and compared upper-case; what the shopper types is normalised */
  code: string;
  /** one line, shown under the field once the code is on */
  label: string;
  kind: "percent" | "amount";
  /** whole percent off the merchandise subtotal, or a flat rupee amount */
  value: number;
  /** the merchandise subtotal the bag has to reach, in rupees */
  minSubtotal: number;
};

export const COUPONS: Coupon[] = [
  {
    code: "AFTERDARK15",
    label: "15% off Drop 001",
    kind: "percent",
    value: 15,
    minSubtotal: 7500,
  },
  {
    code: "FIRSTICE10",
    label: "10% off your first bag",
    kind: "percent",
    value: 10,
    minSubtotal: 0,
  },
  {
    code: "FREEZE500",
    label: "₹500 off",
    kind: "amount",
    value: 500,
    minSubtotal: 4999,
  },
];

/**
 * What a coupon takes off a given subtotal.
 *
 * Clamped to the subtotal so a flat-amount code can never drive a bag negative,
 * and rounded to whole rupees — a discount that renders as ₹1,234.5 is a bug
 * report waiting to happen.
 */
export function discountFor(coupon: Coupon | null, subtotal: number) {
  if (!coupon || subtotal <= 0) return 0;
  if (subtotal < coupon.minSubtotal) return 0;

  const raw =
    coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;

  return Math.min(subtotal, Math.round(raw));
}

export type RedeemResult =
  | { ok: true; coupon: Coupon }
  /** `reason` is written to be shown to the shopper as-is */
  | { ok: false; reason: string };

/**
 * Look a typed code up against the table.
 *
 * The minimum is checked HERE rather than after the fact, so a code that cannot
 * do anything yet is refused with the number it is waiting for instead of being
 * accepted and then quietly discounting nothing.
 *
 * `table` is what the bag will accept, which is the promotions above PLUS
 * whatever store credit the shopper is holding — see `vouchers.ts`. It is a
 * parameter rather than an import so this file stays a fixture with no idea
 * that vouchers exist, and so one function owns redemption for both.
 */
export function redeemCoupon(
  input: string,
  subtotal: number,
  formatPrice: (value: number) => string,
  table: Coupon[] = COUPONS,
): RedeemResult {
  const code = input.trim().toUpperCase();
  if (!code) return { ok: false, reason: "Enter a code." };

  const coupon = table.find((entry) => entry.code === code);
  if (!coupon) return { ok: false, reason: `${code} is not a code we know.` };

  if (subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      reason: `${coupon.code} needs a subtotal of ${formatPrice(coupon.minSubtotal)}.`,
    };
  }

  return { ok: true, coupon };
}
