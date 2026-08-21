/**
 * Support, as one list.
 *
 * A shopper sends a query from `/account/support`. It lands here. An admin
 * reads it on `/admin/support` and writes one reply back, which the shopper
 * then sees against their own query. That is the whole module — there is no
 * ticket queue, no knowledge base and no live chat behind it.
 *
 * This module is the SHAPE and the seed, in plain data so the dashboard can
 * count it without mounting anything. The live list lives next door in
 * `support-store.ts`.
 */
export type SupportQuery = {
  /** What the shopper quotes when they ask about it. */
  reference: string;
  customer: string;
  email: string;
  topic: string;
  /** The order this is about, or `NO_ORDER` when it is a general question. */
  order: string;
  message: string;
  sentAt: string;
  status: "Open" | "Resolved";
  /** What the admin wrote back. Empty until someone answers. */
  reply: string;
  /**
   * When that answer was written, or empty while there is none.
   *
   * Not the same as `sentAt`, which is when the shopper asked. The inbox needs
   * this one: a reply dated by the question it answers is dated wrong.
   */
  answeredAt: string;
};

/** The five things a query can be about. Both sides read this one list. */
export const SUPPORT_TOPICS = [
  "Delivery",
  "Return or exchange",
  "Payment or refund",
  "Product and fit",
  "Something else",
] as const;

/** The value a query carries when it is not about any particular order. */
export const NO_ORDER = "No order";

/* The seeded queries are gone: both sides of support read `support_queries`
   through the API (see `support-store`). What stays is the shape both sides render
   and the two constants they share — the fallback topic list, used only until the
   server's own vocabulary arrives, and the word for "no order". */
