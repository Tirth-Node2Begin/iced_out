import {
  availableUnits,
  stockItemFixtures,
  stockLevel,
} from "@/features/03-inventory/data/stock-fixtures";
import { adminOrderFixtures } from "@/features/07-orders/data/admin-order-fixtures";
import { GATEWAYS, money, payments, refunds } from "@/features/09-payment/payment-data";
import { seededReviews } from "@/features/11-reviews/reviews";
import { supportQuerySeed } from "@/features/14-support/data/support-queries";
import { shipmentFixtures } from "@/features/17-shipping/data/shipment-fixtures";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";

/**
 * The operations pulse — what the bell in the topbar is counting.
 *
 * The drawer used to hold three hand-written lines. Three lines is not a pulse,
 * it is a screenshot: it named a webhook nobody could open, a stock problem on
 * a drop that is not in the catalogue, and an RMA id that does not exist. An
 * operator who clicks one of those and lands nowhere stops clicking any of them.
 *
 * So every signal here is READ OFF A FIXTURE the console already renders, and
 * carries the route that acts on it. If the pulse says a payment failed, that
 * payment is on the payments register; if it says a return is waiting, that
 * return opens. The bell can no longer name something the store does not have.
 *
 * Time is counted in SECONDS SINCE THE PULSE STARTED, never from the clock —
 * the same rule the activity log follows, and for the same reason: this app is
 * statically exported, so a `Date` read during render disagrees with the
 * build's idea of now and the drawer hydrates with its timestamps flickering.
 * A clock that starts at zero on both sides cannot.
 */

/** Matches the console's `Tone` — colour lands on the glyph, never on a fill. */
export type SignalTone = "mint" | "amber" | "rose" | "ink";

export type SignalKind =
  | "order"
  | "payment"
  | "shipment"
  | "inventory"
  | "return"
  | "support"
  | "review";

export type Signal = {
  id: string;
  kind: SignalKind;
  tone: SignalTone;
  title: string;
  /** One line of why it is here. Never a second sentence — the drawer is narrow. */
  detail: string;
  /** The screen that acts on it. Every one of these is a route that exists. */
  href: string;
  /** How old it already was when it entered the pulse, in seconds. */
  offset: number;
  /** The pulse clock when it entered. The backlog is born at zero. */
  born: number;
};

/** What the drawer sorts by. Bad news first, then anything with a deadline. */
const RANK: Record<SignalTone, number> = { rose: 0, amber: 1, ink: 2, mint: 3 };

/* --------------------------------------------------------------- the backlog */

/** Everything already waiting when the console opens, most urgent first. */
function standing(): Omit<Signal, "id" | "offset" | "born">[] {
  const signals: Omit<Signal, "id" | "offset" | "born">[] = [];

  /* Money that was asked for and did not arrive. */
  payments
    .filter((payment) => payment.status === "Failed")
    .forEach((payment) => {
      signals.push({
        kind: "payment",
        tone: "rose",
        title: `${money(payment.amount)} did not go through`,
        detail: `${payment.order} · ${payment.note}`,
        href: `/admin/payments/${payment.id}`,
      });
    });

  /* A parcel that came back. The courier is done with it; someone here is not. */
  shipmentFixtures
    .filter((shipment) => shipment.status === "Failed")
    .forEach((shipment) => {
      signals.push({
        kind: "shipment",
        tone: "rose",
        title: `${shipment.order} could not be delivered`,
        detail: `${shipment.provider} · ${shipment.destination} · AWB ${shipment.awb}`,
        href: `/admin/shipments/${shipment.id}`,
      });
    });

  /* Refunds the store still owes, and refunds that tried and failed. */
  refunds
    .filter((refund) => refund.status === "Requested" || refund.status === "Failed")
    .forEach((refund) => {
      signals.push({
        kind: "payment",
        tone: refund.status === "Failed" ? "rose" : "amber",
        title:
          refund.status === "Failed"
            ? `Refund of ${money(refund.amount)} failed`
            : `Refund of ${money(refund.amount)} requested`,
        detail: `${refund.order} · ${refund.reason}`,
        href: "/admin/payments",
      });
    });

  /* Nothing left to sell, and nearly nothing left to sell. */
  stockItemFixtures.forEach((item) => {
    const level = stockLevel(item);
    if (level === "Healthy") return;
    signals.push({
      kind: "inventory",
      tone: level === "Out" ? "rose" : "amber",
      title:
        level === "Out"
          ? `${item.itemName} is out of stock`
          : `${item.itemName} is down to ${availableUnits(item)}`,
      detail: `${item.sizes} · ${item.warehouse}`,
      href: "/admin/inventory/overview",
    });
  });

  /* Returns nobody has decided on yet. */
  adminReturnFixtures
    .filter((entry) => entry.state === "New")
    .forEach((entry) => {
      signals.push({
        kind: "return",
        tone: "amber",
        title: `${entry.id.toUpperCase()} is waiting on a decision`,
        detail: `${entry.item} · ${entry.reason} · ${entry.outcome}`,
        href: `/admin/returns/${entry.id}`,
      });
    });

  /* Orders that have arrived and not yet been agreed to. */
  adminOrderFixtures
    .filter((order) => order.status === "Placed")
    .forEach((order) => {
      signals.push({
        kind: "order",
        tone: "amber",
        title: `${order.id} is waiting on confirmation`,
        detail: `${order.customer} · ${money(order.value)} · ${order.destination}`,
        href: `/admin/orders/${order.id}`,
      });
    });

  /* Someone asked a question and is still waiting for the answer. */
  supportQuerySeed
    .filter((query) => query.status === "Open")
    .forEach((query) => {
      signals.push({
        kind: "support",
        tone: "ink",
        title: `${query.reference} has had no reply`,
        detail: `${query.customer} · ${query.topic}`,
        href: "/admin/support",
      });
    });

  /* Feedback the storefront cannot quote until someone decides on it. */
  seededReviews
    .filter((review) => review.status === "Pending")
    .forEach((review) => {
      signals.push({
        kind: "review",
        tone: "ink",
        title: `${review.rating}★ review awaiting moderation`,
        detail: `${review.product} · ${review.customer}`,
        href: "/admin/reviews",
      });
    });

  return signals.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

/**
 * How stale each standing signal is when the drawer first opens.
 *
 * A ladder rather than a formula so the top of the list reads in minutes and
 * the tail reads in hours — the shape a real backlog has. Anything past the end
 * of the ladder keeps stepping by forty minutes.
 */
const AGE_LADDER = [
  45, 132, 268, 431, 690, 1_020, 1_460, 1_980, 2_610, 3_360, 4_240, 5_260, 6_430, 7_760, 9_260,
  10_940,
];

function ageAt(index: number): number {
  const last = AGE_LADDER[AGE_LADDER.length - 1];
  return AGE_LADDER[index] ?? last + (index - AGE_LADDER.length + 1) * 2_400;
}

/** The pulse as it stands on arrival. Deterministic, so it survives hydration. */
export function standingSignals(): Signal[] {
  return standing().map((signal, index) => ({
    ...signal,
    id: `PLS-${7_200 + index}`,
    offset: ageAt(index),
    born: 0,
  }));
}

/* ------------------------------------------------------------ what arrives next */

/** Integer-only hash → a stable float in [0, 1). Same one the activity log uses. */
function hash(seed: number): number {
  let x = (seed ^ 0x9e37_79b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0_aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a_2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 0x1_0000_0000;
}

/** Deterministic pick, so the same index always yields the same signal. */
function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.floor(hash(seed) * list.length) % list.length];
}

type Template = (seed: number) => Omit<Signal, "id" | "offset" | "born">;

/**
 * One template per thing that can newly need an operator's attention. Each
 * reads a real record, so an arriving signal can never name an order, a SKU or
 * an RMA that is not in the console.
 */
const TEMPLATES: Template[] = [
  (seed) => {
    const order = pick(adminOrderFixtures, seed);
    return {
      kind: "order",
      tone: "amber",
      title: `${order.id} is waiting on confirmation`,
      detail: `${order.customer} · ${money(order.value)} · ${order.destination}`,
      href: `/admin/orders/${order.id}`,
    };
  },
  (seed) => {
    const payment = pick(
      payments.filter((entry) => entry.status === "Captured"),
      seed,
    );
    return {
      kind: "payment",
      tone: "mint",
      title: `${money(payment.amount)} captured`,
      detail: `${payment.order} · ${payment.gateway} · ${payment.method}`,
      href: `/admin/payments/${payment.id}`,
    };
  },
  (seed) => {
    const shipment = pick(shipmentFixtures, seed);
    return {
      kind: "shipment",
      tone: "ink",
      title: `${shipment.order} is with ${shipment.provider}`,
      detail: `${shipment.destination} · promised ${shipment.promise}`,
      href: `/admin/shipments/${shipment.id}`,
    };
  },
  (seed) => {
    const query = pick(supportQuerySeed, seed);
    return {
      kind: "support",
      tone: "ink",
      title: `${query.reference} needs an answer`,
      detail: `${query.customer} · ${query.topic}`,
      href: "/admin/support",
    };
  },
  (seed) => {
    const review = pick(seededReviews, seed);
    return {
      kind: "review",
      tone: "ink",
      title: `${review.rating}★ review awaiting moderation`,
      detail: `${review.product} · ${review.customer}`,
      href: "/admin/reviews",
    };
  },
  (seed) => {
    const entry = pick(adminReturnFixtures, seed);
    return {
      kind: "return",
      tone: "amber",
      title: `${entry.id.toUpperCase()} is waiting on QC`,
      detail: `${entry.item} · ${entry.reason}`,
      href: `/admin/returns/${entry.id}`,
    };
  },
  /* The gateway telling on itself. The one signal with no record behind it —
     it is about the pipe the records arrive through, not about a record. */
  (seed) => {
    const gateway = pick(GATEWAYS.slice(0, 3), seed);
    return {
      kind: "payment",
      tone: "mint",
      title: `${gateway} webhook latency recovered`,
      detail: "Delivery is back below 8 seconds.",
      href: "/admin/payments",
    };
  },
  /* The two that are not good news. Kept rarer than the rest by the weights. */
  (seed) => {
    const item = pick(stockItemFixtures, seed);
    return {
      kind: "inventory",
      tone: "amber",
      title: `${item.itemName} fell to ${availableUnits(item)} available`,
      detail: `${item.sizes} · ${item.warehouse}`,
      href: "/admin/inventory/overview",
    };
  },
  (seed) => {
    const payment = pick(payments, seed);
    return {
      kind: "payment",
      tone: "rose",
      title: `${money(payment.amount)} did not go through`,
      detail: `${payment.order} · ${payment.gateway}`,
      href: `/admin/payments/${payment.id}`,
    };
  },
];

/* Seven of nine draws land on something routine. A pulse where every third
   arrival is an exception trains an operator to stop opening it. */
const WEIGHTED = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6] as const;

/** The signal that arrives at position `index`. Always the same signal. */
export function signalAt(index: number, born: number): Signal {
  const template = TEMPLATES[pick(WEIGHTED, index * 7 + 3)];
  return {
    ...template(index * 13 + 5),
    id: `PLS-${8_000 + index}`,
    born,
    offset: 0,
  };
}

/** How many signals the drawer holds before the oldest falls off the bottom. */
export const PULSE_LIMIT = 40;

/* Relative age is the activity log's, not a second copy of it: the drawer and
   the feed are two views of the same console and must not disagree about what
   "14 min ago" means. */
export { ageLabel } from "@/features/15-dashboard/data/activity-log";
