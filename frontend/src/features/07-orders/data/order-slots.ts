/**
 * The ids a placed order is allowed to take.
 *
 * `next build` writes this site out as static HTML, so `/account/orders/<id>`
 * only exists for the ids `generateStaticParams` knew at build time — an id
 * invented in the browser at checkout would 404 on the exported site. Orders
 * placed on this device therefore take the next free id out of this pool, all
 * of which ARE exported. Nobody sees the difference: the screen is titled with
 * the order number, and the id is only ever a route.
 *
 * A plain module rather than part of the store, because `generateStaticParams`
 * runs on the server and the store is a client component.
 */
export const ORDER_SLOT_COUNT = 30;

export const reservedOrderSlots = Array.from(
  { length: ORDER_SLOT_COUNT },
  (_, index) => `ord-local-${String(index + 1).padStart(2, "0")}`,
);

/**
 * The tracking token that belongs to each slot.
 *
 * Shipment tracking is a PUBLIC page addressed by a token rather than by an
 * order id — that is the whole point of it, a link that can be forwarded to
 * whoever is waiting in for the parcel without handing them the account. It
 * needs prerendering for the same reason the order does, and pairing it with
 * the slot means an order never has to invent a token the export cannot serve.
 */
export const reservedTrackingTokens = Array.from(
  { length: ORDER_SLOT_COUNT },
  (_, index) => `track-local-${String(index + 1).padStart(2, "0")}`,
);

/** `ord-local-07` → `track-local-07`, or "" for an id outside the pool. */
export function trackingTokenForSlot(slotId: string) {
  const index = reservedOrderSlots.indexOf(slotId);
  return index === -1 ? "" : reservedTrackingTokens[index];
}
