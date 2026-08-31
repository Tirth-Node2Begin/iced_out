/**
 * The customer register's vocabulary and its money formatting.
 *
 * What this file used to hold as well: eight invented customers, a map of their
 * invented orders, and a band of thirty "reserved" ids a shopper signing up in
 * the browser could claim so that `/admin/customers/<id>` would exist in the
 * static export. All three are gone.
 *
 * The customers come from `/admin/customers` (see `customers-store`), their
 * orders from `/admin/customers/{id}/orders`, and the reserved-id band is not
 * needed at all now that the detail screen is addressed by `?id=` rather than by
 * a pre-built path segment — see `components/admin/record-route.tsx`.
 *
 * Kept free of `"use client"`: plain data and pure functions.
 */

/**
 * Two states, and blocking keeps the history.
 *
 * The API stores these as `ACTIVE` / `BLOCKED` on `users.status` and presents
 * them in these words (`ConsoleCustomerPresenter`), so the two agree.
 */
export const CUSTOMER_STATES = ["Active", "Blocked"];

/**
 * A timestamp in the console's own format — "13 Aug, 14:34".
 *
 * Still used by the screens that stamp something locally as it happens. A
 * customer's `seen` is NOT one of them any more: that is `last_seen_at`, written
 * by the API when the shopper actually signs in, which is the only place that can
 * know.
 */
export function stampNow() {
  const now = new Date();
  const day = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

/** "₹42,600" back to 42600, so a column of money can be added up. */
export function moneyValue(value: string | undefined) {
  return Number((value ?? "").replace(/[^\d]/g, "")) || 0;
}

export function rupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
