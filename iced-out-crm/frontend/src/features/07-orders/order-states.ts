/**
 * The vocabularies an order's record is drawn from.
 *
 * Split out of `data/admin-order-fixtures.ts`, which held these constants beside
 * a hand-written list of demo orders. The orders are gone — the register reads
 * `/admin/orders` — but the vocabularies are still needed, by the filter chips
 * that name every state whether or not any order is in it, and by the screens
 * that colour a row by what it says.
 *
 * These mirror the states the API writes (`OrderPresenter`, and the
 * `console_state` column behind it). They have to agree: a chip for a state the
 * server never produces reads permanently zero, and a state the server produces
 * that is missing here gets no chip at all.
 *
 * Kept free of `"use client"`: plain data, so a server component can read it.
 */

/**
 * An order has three states and no more. It is `Placed` when it arrives,
 * `Confirmed` once a person agrees it is real, and `Cancelled` if it is called
 * off — by the store or by the customer, which are the same fact about the
 * order and differ only in who is recorded as having asked.
 *
 * Everything after confirmation is the shipment's business, not the order's.
 */
export const ORDER_STATES = ["Placed", "Confirmed", "Cancelled"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/**
 * How the payment stands, in the console's words.
 *
 * The register says "Pending" where the payments ledger says "Due" — see
 * `OrderPresenter::PAYMENT_LABEL`, which does that translation on the way out.
 */
export const PAYMENT_STATES = ["Captured", "Pending", "Failed", "Refunded"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/** How the money moved. Shown on the record wherever payment is. */
export const PAYMENT_METHODS = ["UPI", "Card", "Netbanking", "Cash on delivery"] as const;

/** Who called the order off. Empty unless the order is cancelled. */
export const CANCELLED_BY = ["Store", "Customer"] as const;
