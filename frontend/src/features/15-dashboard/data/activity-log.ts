import {
  availableUnits,
  stockItemFixtures,
  stockLevel,
} from "@/features/03-inventory/data/stock-fixtures";
import { adminOrderFixtures } from "@/features/07-orders/data/admin-order-fixtures";
import { money, paymentExceptions, payments } from "@/features/09-payment/payment-data";
import { supportQuerySeed } from "@/features/14-support/data/support-queries";
import { shipmentFixtures } from "@/features/17-shipping/data/shipment-fixtures";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";

/**
 * The console's activity log.
 *
 * What actually happened, newest first, and it keeps happening while you watch
 * it — the landing screen's third block is a feed rather than a static notice
 * board, because "is anything moving right now" is a question an operator asks
 * far more often than "what was true when this page loaded".
 *
 * Every line is drawn from the same fixtures the registers render, so an order
 * id in the log is an order you can open, and a SKU is a SKU that exists.
 *
 * Time is counted in SECONDS SINCE THE FEED STARTED, never from the clock. The
 * app is statically exported, so a `Date` read during render disagrees with
 * the build's idea of now and the page hydrates with the timestamps flickering.
 * A feed clock that starts at zero on both sides cannot.
 */

export type LogTone = "good" | "warn" | "bad" | "info";

export type LogSource =
  | "Orders"
  | "Payments"
  | "Shipping"
  | "Inventory"
  | "Returns"
  | "Support";

export type LogEntry = {
  id: string;
  source: LogSource;
  /** The machine name, shown under the title — this is an audit line, not a tweet. */
  action: string;
  title: string;
  detail: string;
  actor: string;
  state: string;
  tone: LogTone;
  /** How old the line already was when it entered the feed, in seconds. */
  offset: number;
  /** The feed clock when it entered. The backlog is born at zero. */
  born: number;
};

/** Integer-only hash → a stable float in [0, 1). Same one the series uses. */
function hash(seed: number): number {
  let x = (seed ^ 0x9e37_79b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0_aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a_2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 0x1_0000_0000;
}

/** Deterministic pick, so the same index always yields the same line. */
function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.floor(hash(seed) * list.length) % list.length];
}

/* The people who work this console. Same names the audit log already uses. */
const STAFF = ["Aarav D.", "Mira P.", "Neha A.", "Kabir R."] as const;

/* ------------------------------------------------------------- templates */

type Template = (seed: number) => Omit<LogEntry, "id" | "offset" | "born">;

/**
 * One template per thing that actually happens in this console. Each reads a
 * real record, so the feed can never name an order or a SKU that isn't there.
 */
const TEMPLATES: Template[] = [
  (seed) => {
    const order = pick(adminOrderFixtures, seed);
    return {
      source: "Orders",
      action: "order.confirmed",
      title: `Order ${order.id} confirmed`,
      detail: `${order.customer} · ${order.items === "1" ? "1 item" : `${order.items} items`}`,
      actor: pick(STAFF, seed + 11),
      state: "Done",
      tone: "good",
    };
  },
  (seed) => {
    const payment = pick(payments, seed);
    return {
      source: "Payments",
      action: "payment.captured",
      title: `${money(payment.amount)} captured on ${payment.order}`,
      detail: `${payment.gateway} · ${payment.method}`,
      actor: "System",
      state: "Captured",
      tone: "good",
    };
  },
  (seed) => {
    const shipment = pick(shipmentFixtures, seed);
    return {
      source: "Shipping",
      action: "shipment.dispatched",
      title: `${shipment.order} handed to ${shipment.provider}`,
      detail: `AWB ${shipment.awb} · ${shipment.destination}`,
      actor: pick(STAFF, seed + 23),
      state: "In transit",
      tone: "info",
    };
  },
  (seed) => {
    const item = pick(stockItemFixtures, seed);
    return {
      source: "Inventory",
      action: "inventory.adjusted",
      title: `${item.itemName} recounted at ${item.warehouse}`,
      detail: `${item.sizes} · ${availableUnits(item)} available`,
      actor: pick(STAFF, seed + 37),
      state: "Done",
      tone: "good",
    };
  },
  (seed) => {
    const entry = pick(adminReturnFixtures, seed);
    return {
      source: "Returns",
      action: "return.approved",
      title: `${entry.id} approved`,
      detail: `${entry.item} · ${entry.outcome}`,
      actor: pick(STAFF, seed + 53),
      state: "Done",
      tone: "good",
    };
  },
  (seed) => {
    const query = pick(supportQuerySeed, seed);
    return {
      source: "Support",
      action: "query.replied",
      title: `${query.reference} answered`,
      detail: `${query.topic} · ${query.customer}`,
      actor: pick(STAFF, seed + 71),
      state: "Waiting",
      tone: "info",
    };
  },
  /* The two that are not good news. Kept rarer than the rest by weight below. */
  (seed) => {
    const problem = pick(paymentExceptions, seed);
    return {
      source: "Payments",
      action: "payment.failed",
      title: `${money(problem.amount)} did not go through on ${problem.order}`,
      detail: `${problem.note} · ${problem.gateway}`,
      actor: "System",
      state: "Failed",
      tone: "bad",
    };
  },
  (seed) => {
    const item = pick(
      stockItemFixtures.filter((entry) => stockLevel(entry) !== "Healthy"),
      seed,
    );
    const level = stockLevel(item);
    return {
      source: "Inventory",
      action: "stock.low",
      title: `${item.itemName} fell to ${availableUnits(item)} available`,
      detail: `${item.sizes} · ${item.warehouse}`,
      actor: "System",
      state: level === "Out" ? "Out" : "Low",
      tone: level === "Out" ? "bad" : "warn",
    };
  },
];

/* Six of eight draws land on a routine template. A feed where every third line
   is an exception trains an operator to stop reading it. */
const WEIGHTED = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5] as const;

/** The line at position `index` in the feed's history. Always the same line. */
export function eventAt(index: number, born: number, offset: number): LogEntry {
  const template = TEMPLATES[pick(WEIGHTED, index * 7 + 3)];
  return {
    ...template(index * 13 + 5),
    id: `EVT-${9_400 + index}`,
    born,
    offset,
  };
}

/** How stale each backlog line is when the screen opens. Newest first. */
const BACKLOG_AGES = [14, 68, 176, 355, 622, 1_014, 1_580, 2_460];

/** The history already on the wall. Deterministic, so it survives hydration. */
export function backlog(): LogEntry[] {
  return BACKLOG_AGES.map((age, index) => eventAt(index, 0, age));
}

/** How many lines the table holds before the oldest falls off the bottom. */
export const FEED_LIMIT = 8;

/* ------------------------------------------------------------------ time */

/** Relative age, in the console's voice. Never a clock time — this is a feed. */
export function ageLabel(seconds: number): string {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return minutes ? `${hours} h ${minutes} m ago` : `${hours} h ago`;
}
