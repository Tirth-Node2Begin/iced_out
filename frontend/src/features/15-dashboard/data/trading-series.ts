/**
 * A day-by-day trading series, indexed backwards from today.
 *
 * The dashboard's date filter has to add something up, so this is the thing it
 * adds up. Two rules keep it honest:
 *
 *   1. Offset 0 is stated, not generated. Those are the numbers this console
 *      has always shown for "today", so switching the filter to Today lands
 *      exactly where the screen used to.
 *   2. Every other day is derived from an INTEGER hash of its offset. No
 *      `Math.random`, no `Date` — the same offset yields the same day in the
 *      build's render and in the browser's, so a statically exported page
 *      hydrates without a number changing underneath it.
 *
 * Days are offsets rather than calendar dates for the same reason: a date
 * baked at build time is wrong the next morning, whereas "yesterday" is
 * always yesterday.
 */

export type TradingDay = {
  /** 0 is today, 1 is yesterday, and so on backwards. */
  offset: number;
  revenue: number;
  orders: number;
  sessions: number;
  /** Orders from this day that came back. */
  returns: number;
};

/**
 * Long enough for the widest range (90 days) AND the 90 days before it, so a
 * comparison never runs off the end of the series.
 */
export const SERIES_DAYS = 200;

/** Integer-only hash → a stable float in [0, 1). Reproducible on any engine. */
function hash(seed: number): number {
  let x = (seed ^ 0x9e37_79b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0_aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a_2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 0x1_0000_0000;
}

/**
 * The weekly rhythm. Index 0 is today's weekday, so the shape repeats every
 * seven days backwards — which is what makes a 7-day total comparable to the
 * 7 days before it.
 */
const RHYTHM = [1.14, 0.93, 0.88, 0.95, 1.04, 1.19, 1.27];

function generate(offset: number): TradingDay {
  /* Trade has been climbing, so a day further back is a slightly lighter day. */
  const trend = 1 - offset * 0.0016;
  const jitter = 0.88 + hash(offset) * 0.26;
  const orders = Math.max(6, Math.round(42 * RHYTHM[offset % 7] * trend * jitter));
  const basket = 7_400 + Math.round(hash(offset + 977) * 2_600);
  const sessions = Math.round(orders * (24 + hash(offset + 5_501) * 8));
  const returns = Math.round(orders * (0.08 + hash(offset + 131) * 0.07));

  return { offset, revenue: orders * basket, orders, sessions, returns };
}

/** Today. Stated, so the landing screen keeps the figures it has always had. */
const TODAY: TradingDay = {
  offset: 0,
  revenue: 428_420,
  orders: 48,
  sessions: 1_249,
  returns: 5,
};

export const tradingSeries: TradingDay[] = Array.from({ length: SERIES_DAYS }, (_, offset) =>
  offset === 0 ? TODAY : generate(offset),
);
