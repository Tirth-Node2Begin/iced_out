/**
 * The ids a payment taken in the browser is allowed to take.
 *
 * `next build` writes this site out as static HTML, so `/admin/payments/<id>`
 * only exists for the ids `generateStaticParams` knew at build time — and a
 * gateway's own `pay_Nx8k…` id is minted on a server this build has never
 * spoken to. A payment recorded from checkout therefore takes the next free id
 * out of this pool, all of which ARE exported, and keeps the gateway's id
 * alongside it as the reference. Nobody sees a difference: the ids are shaped
 * like the seeded ones, and the gateway reference is on the record.
 *
 * A plain module rather than part of the store, because `generateStaticParams`
 * runs on the server and the store is a client module. Same reasoning, and the
 * same shape, as `order-slots`.
 */
export const PAYMENT_SLOT_COUNT = 30;

export const reservedPaymentSlots = Array.from(
  { length: PAYMENT_SLOT_COUNT },
  (_, index) => `pay_ICE${2_001 + index}`,
);

const POOL = new Set(reservedPaymentSlots);

/** Was this payment recorded on this device, rather than seeded? */
export function isReservedPayment(id: string) {
  return POOL.has(id);
}
