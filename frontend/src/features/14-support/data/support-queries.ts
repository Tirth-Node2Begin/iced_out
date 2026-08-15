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

/**
 * What a fresh device is shown, so the console is never an empty screen you
 * cannot tell apart from a broken one.
 */
export const supportQuerySeed: SupportQuery[] = [
  {
    reference: "IO-Q-1003",
    customer: "Riya S.",
    email: "riya@example.com",
    topic: "Payment or refund",
    order: "IO-2026-1047",
    message:
      "I paid by UPI and the money has left my account, but the order still says it is waiting for confirmation. I do not want to pay twice.",
    sentAt: "04 Aug 2026 · 14:18",
    status: "Open",
    reply: "",
  },
  {
    reference: "IO-Q-1002",
    customer: "Maya P.",
    email: "maya@example.com",
    topic: "Delivery",
    order: "IO-2026-1046",
    message:
      "The courier has marked me as unavailable, but nobody came to the address. Can it be sent out again this week?",
    sentAt: "04 Aug 2026 · 11:05",
    status: "Open",
    reply: "",
  },
  {
    reference: "IO-Q-1001",
    customer: "Aarav K.",
    email: "aarav@example.com",
    topic: "Product and fit",
    order: NO_ORDER,
    message:
      "I am between sizes on the utility overshirt. Which size should I take if I usually wear a medium?",
    sentAt: "03 Aug 2026 · 17:40",
    status: "Resolved",
    reply:
      "The overshirt is cut loose, so a medium is the right call — take the large only if you plan to layer a hoodie under it.",
  },
];
