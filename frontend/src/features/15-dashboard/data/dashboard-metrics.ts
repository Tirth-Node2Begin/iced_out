import { stockItemFixtures, stockLevel } from "@/features/03-inventory/data/stock-fixtures";
import { adminOrderFixtures, ageMinutes } from "@/features/07-orders/data/admin-order-fixtures";
import { paymentExceptions } from "@/features/09-payment/payment-data";
import { NO_ORDER, supportQuerySeed } from "@/features/14-support/data/support-queries";
import { shipmentFixtures } from "@/features/17-shipping/data/shipment-fixtures";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";
import { SERIES_DAYS, tradingSeries } from "@/features/15-dashboard/data/trading-series";

/**
 * Everything the landing screen puts a number on.
 *
 * Two halves, and they answer different questions on purpose:
 *
 *   - TRADING is a period. It sums the day series over whatever the date
 *     filter selected, and against the period immediately before it so a
 *     movement is a comparison rather than a decoration.
 *   - QUEUES are a moment. They are counted off the same fixtures the
 *     registers render, so the dashboard cannot disagree with the screen it
 *     links to — open "orders to confirm" and you find exactly that many rows.
 */

/* ==================================================== the selected period */

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export type RangePreset = { key: Exclude<RangeKey, "custom">; label: string; days: number };

export const RANGE_PRESETS: RangePreset[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
];

/** A slice of the series: `start` is the NEWEST day in it, counted back from today. */
export type Window = { start: number; length: number };

export type Totals = {
  days: number;
  revenue: number;
  orders: number;
  sessions: number;
  returns: number;
  /** Average order value. 0 when the window held no orders. */
  basket: number;
  /** Orders per session, as a percentage. */
  conversion: number;
  /** Returns per order, as a percentage. */
  returnRate: number;
};

const EMPTY: Totals = {
  days: 0,
  revenue: 0,
  orders: 0,
  sessions: 0,
  returns: 0,
  basket: 0,
  conversion: 0,
  returnRate: 0,
};

function sum({ start, length }: Window): Totals {
  const days = tradingSeries.slice(Math.max(0, start), Math.max(0, start) + Math.max(0, length));
  if (!days.length) return EMPTY;

  const revenue = days.reduce((run, day) => run + day.revenue, 0);
  const orders = days.reduce((run, day) => run + day.orders, 0);
  const sessions = days.reduce((run, day) => run + day.sessions, 0);
  const returns = days.reduce((run, day) => run + day.returns, 0);

  return {
    days: days.length,
    revenue,
    orders,
    sessions,
    returns,
    basket: orders ? Math.round(revenue / orders) : 0,
    conversion: sessions ? (orders / sessions) * 100 : 0,
    returnRate: orders ? (returns / orders) * 100 : 0,
  };
}

export type Period = {
  current: Totals;
  /** The same number of days immediately before it — empty if the series ends first. */
  previous: Totals;
};

export function periodFor(window: Window): Period {
  const current = sum(window);
  const previous = sum({ start: window.start + current.days, length: current.days });
  return { current, previous };
}

/* ---------------------------------------------------------- calendar dates */

/* Everything below reads the clock, so none of it may run during a server
   render: this app is statically exported, and a date baked at build time is
   wrong by the next morning. Call these behind `useHydrated()` or from an
   event handler only. */

const DAY_MS = 86_400_000;

/** Local midnight today. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Local midnight, `count` days back. Stepped rather than subtracted in ms, so
    a daylight-saving boundary inside the range cannot shift the wall clock. */
function daysBefore(count: number): Date {
  const day = today();
  day.setDate(day.getDate() - count);
  return day;
}

/** How far back a date sits. 0 is today, 1 is yesterday. */
function offsetOf(date: Date): number {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today().getTime() - midnight.getTime()) / DAY_MS);
}

/**
 * A picked calendar range → a window on the series. Null while the pair is
 * incomplete or lands entirely outside the series, so the caller can hold the
 * numbers already on screen rather than flashing zeroed cards mid-pick.
 */
export function windowFromRange(from?: Date, to?: Date): Window | null {
  if (!from || !to) return null;

  /* A bigger offset is an older day, so the newest end is the smaller one. */
  const newest = Math.max(0, Math.min(offsetOf(from), offsetOf(to)));
  const oldest = Math.min(SERIES_DAYS - 1, Math.max(offsetOf(from), offsetOf(to)));
  if (oldest < newest) return null;

  return { start: newest, length: oldest - newest + 1 };
}

/** The inverse: the calendar range a window covers, so a preset fills the picker. */
export function rangeFromWindow({ start, length }: Window): { from: Date; to: Date } {
  return { from: daysBefore(start + length - 1), to: daysBefore(start) };
}

/** The oldest day the series can answer for — the calendar's floor. */
export function earliestDay(): Date {
  return daysBefore(SERIES_DAYS - 1);
}

/* -------------------------------------------------------------- movements */

export type Delta = { dir: "up" | "down"; value: string };

/** Percentage change against the previous period. Omitted when there is none. */
export function change(current: number, previous: number): Delta | undefined {
  if (!previous) return undefined;
  const shift = ((current - previous) / previous) * 100;
  if (Math.abs(shift) < 0.05) return undefined;
  return { dir: shift > 0 ? "up" : "down", value: `${Math.abs(shift).toFixed(1)}%` };
}

/** For rates, where a difference in points is the honest comparison. */
export function pointChange(current: number, previous: number): Delta | undefined {
  if (!previous) return undefined;
  const shift = current - previous;
  if (Math.abs(shift) < 0.05) return undefined;
  return { dir: shift > 0 ? "up" : "down", value: `${Math.abs(shift).toFixed(2)} pts` };
}

/* ============================================================== the queues */

export type QueueCount = { count: number; note: string };

const confirming = adminOrderFixtures.filter((order) => order.status === "Placed");
/* The oldest order IN THIS QUEUE — an order waiting on payment review is
   somebody else's problem and would make the note read as a false alarm. */
const oldestWait = [...confirming].sort((a, b) => ageMinutes(b.age) - ageMinutes(a.age))[0];

/* A parcel is created at the moment it is dispatched, so what is waiting to go
   out is an ORDER that nothing is carrying yet — not a shipment in some
   pre-dispatch state, which no longer exists. */
const readyToDispatch = adminOrderFixtures.filter(
  (order) =>
    order.status === "Confirmed" &&
    !shipmentFixtures.some((shipment) => shipment.order === order.id),
);
const failedDelivery = shipmentFixtures.filter((shipment) => shipment.status === "Failed");
const returnsToReview = adminReturnFixtures.filter((entry) => entry.state === "New");
const returnsApproved = adminReturnFixtures.filter((entry) => entry.state === "Approved");
const low = stockItemFixtures.filter((item) => stockLevel(item) === "Low");
const out = stockItemFixtures.filter((item) => stockLevel(item) === "Out");
const openTickets = supportQuerySeed.filter((query) => query.status === "Open");
const aboutAnOrder = openTickets.filter((query) => query.order !== NO_ORDER);

/**
 * The six queues worth a card. Everything else in the console is either an
 * outcome (it belongs in the period row above) or a register you go looking
 * for rather than one that comes looking for you.
 */
export const queues = {
  ordersToConfirm: {
    count: confirming.length,
    note: oldestWait ? `Oldest waiting ${oldestWait.age}` : "Queue is clear",
  },
  paymentExceptions: {
    count: paymentExceptions.length,
    /* Named rather than counted: with one or two of them, what went wrong is
       the useful bit — and it is the same sentence the ledger row shows. */
    note: paymentExceptions.map((payment) => payment.note).join(" · ") || "Every payment landed",
  },
  readyToDispatch: {
    count: readyToDispatch.length,
    note: failedDelivery.length
      ? `${failedDelivery.length} delivery exception open`
      : "No delivery exceptions",
  },
  returnsToReview: {
    count: returnsToReview.length,
    note: `${returnsApproved.length} approved, awaiting pickup`,
  },
  stockAtRisk: {
    count: low.length + out.length,
    note: `${low.length} low · ${out.length} out of stock`,
  },
  openTickets: {
    count: openTickets.length,
    note: aboutAnOrder.length
      ? `${aboutAnOrder.length} about an order`
      : "None about an order",
  },
} satisfies Record<string, QueueCount>;

/** What the queue row adds up to — the one number for "work outstanding". */
export const openWork = Object.values(queues).reduce((run, queue) => run + queue.count, 0);

/** Two digits, so a row of counts does not jump about as they change. */
export function pad(count: number): string {
  return String(count).padStart(2, "0");
}
