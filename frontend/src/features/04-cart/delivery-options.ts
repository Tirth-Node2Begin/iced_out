"use client";

import {
  peekStorefrontConfig,
  useStorefrontConfig,
  type DeliveryMethod,
  type StorefrontConfig,
} from "@/features/04-cart/storefront-config";

/**
 * What delivery costs and how long it takes.
 *
 * One module because three screens quote it — the bag advertises the free
 * threshold, checkout charges it, and the order snapshot records the window
 * that was promised. Two of them disagreeing is how a shopper ends up paying a
 * fee the summary never showed.
 *
 * The FIGURES are no longer here. `FREE_DELIVERY_OVER = 4999`, `499` and `199`
 * were written into this file and five others, while the same three numbers sat
 * in `store_settings.delivery` where an operator could edit them — and the
 * server prices every order from that table. See `storefront-config.ts` for
 * what that would have cost the first time somebody changed one. This module
 * still owns the SHAPE of the choice; the amounts come from the store.
 */

export type { DeliveryMethod };

export type DeliveryOption = {
  id: DeliveryMethod;
  label: string;
  window: string;
  note: string;
  /** working days from today, used to write the estimate onto the order */
  days: [number, number];
};

const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

/** "3–5 working days", from a `[first, last]` pair of working days. */
const windowLabel = ([first, last]: [number, number]) =>
  first === last ? `${first} working day${first === 1 ? "" : "s"}` : `${first}–${last} working days`;

/**
 * The two choices, priced against the store's settings.
 *
 * A function rather than a constant, because the amounts arrive over the
 * network — anything module-level could only ever be the fallback.
 */
export function deliveryOptionsFrom(config: StorefrontConfig): DeliveryOption[] {
  return [
    {
      id: "standard",
      label: "Standard delivery",
      window: windowLabel(config.standardWindow),
      note: `Complimentary over ${rupees(config.freeDeliveryOver)}`,
      days: config.standardWindow,
    },
    {
      id: "express",
      label: "Express delivery",
      window: windowLabel(config.expressWindow),
      note: "Priority handling and dispatch",
      days: config.expressWindow,
    },
  ];
}

/** The choices, for a component — re-renders when the settings land. */
export function useDeliveryOptions(): DeliveryOption[] {
  return deliveryOptionsFrom(useStorefrontConfig());
}

export function deliveryOption(method: DeliveryMethod) {
  const options = deliveryOptionsFrom(peekStorefrontConfig());
  return options.find((option) => option.id === method) ?? options[0];
}

/**
 * Delivery is read off the MERCHANDISE subtotal, not the discounted total — a
 * coupon takes money off the goods, it does not un-qualify a bag that has
 * already cleared the advertised threshold.
 *
 * This is the same rule `PlaceOrderService::deliveryFee` applies on the server,
 * against the same settings — which is what stops the summary and the charge
 * disagreeing, and what stops the order's cross-check refusing the bag.
 */
export function deliveryFee(method: DeliveryMethod, subtotal: number) {
  const config = peekStorefrontConfig();

  if (method === "express") return config.expressFee;

  return subtotal >= config.freeDeliveryOver ? 0 : config.standardFee;
}

/**
 * `12 – 14 Aug` for the order record.
 *
 * Only ever called from an event handler at the moment an order is placed —
 * never during render. A date derived at render time is baked into the exported
 * HTML at build time and disagrees with the browser the moment it hydrates.
 */
export function deliveryEstimate(method: DeliveryMethod, from = new Date()) {
  const [first, last] = deliveryOption(method).days;
  const day = (offset: number) =>
    new Date(from.getTime() + offset * 24 * 60 * 60 * 1000);
  const format = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });
  return `${format.format(day(first))} – ${format.format(day(last))}`;
}
