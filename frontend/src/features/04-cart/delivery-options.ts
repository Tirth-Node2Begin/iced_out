/**
 * What delivery costs and how long it takes.
 *
 * One module because three screens quote it — the bag advertises the free
 * threshold, checkout charges it, and the order snapshot records the window
 * that was promised. Two of them disagreeing is how a shopper ends up paying a
 * fee the summary never showed.
 */

/** The threshold the site footer already advertises. Quoted, never re-invented. */
export const FREE_DELIVERY_OVER = 4999;

export type DeliveryMethod = "standard" | "express";

export type DeliveryOption = {
  id: DeliveryMethod;
  label: string;
  window: string;
  note: string;
  /** working days from today, used to write the estimate onto the order */
  days: [number, number];
};

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "standard",
    label: "Standard delivery",
    window: "3–5 working days",
    note: `Complimentary over ₹${FREE_DELIVERY_OVER.toLocaleString("en-IN")}`,
    days: [3, 5],
  },
  {
    id: "express",
    label: "Express delivery",
    window: "1–2 working days",
    note: "Priority handling and dispatch",
    days: [1, 2],
  },
];

export function deliveryOption(method: DeliveryMethod) {
  return DELIVERY_OPTIONS.find((option) => option.id === method) ?? DELIVERY_OPTIONS[0];
}

/**
 * Delivery is read off the MERCHANDISE subtotal, not the discounted total — a
 * coupon takes money off the goods, it does not un-qualify a bag that has
 * already cleared the advertised threshold.
 */
export function deliveryFee(method: DeliveryMethod, subtotal: number) {
  if (method === "express") return 499;
  return subtotal >= FREE_DELIVERY_OVER ? 0 : 199;
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
