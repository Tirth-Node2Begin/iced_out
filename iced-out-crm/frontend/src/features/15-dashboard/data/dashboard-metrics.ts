import type { TradingDay } from "@/features/15-dashboard/dashboard-api";

/**
 * The date filter's arithmetic — window maths, period totals and movements.
 *
 * Pure functions over a series that is PASSED IN. It used to import six fixture
 * modules and export the answers as module constants, which had two consequences
 * worth naming: the numbers were computed once at import time (so nothing could
 * ever change them), and they were computed from demo data (so they described a
 * store that did not exist). The data now comes from `dashboard-api`, and this
 * file does what it was always really about — deciding which days a filter
 * selects and what the movement against the previous period is.
 *
 * Kept free of `"use client"`: plain maths, testable on its own.
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

export const EMPTY_TOTALS: Totals = {
  days: 0,
  revenue: 0,
  orders: 0,
  sessions: 0,
  returns: 0,
  basket: 0,
  conversion: 0,
  returnRate: 0,
};

/**
 * Adds up a window of the series.
 *
 * Indexed by POSITION, and the caller is responsible for handing over a series
 * sorted newest-first — `useTrading` does that. A day the server has no row for
 * is simply absent, so a store that has traded for a week and is asked for
 * ninety days gets a seven-day total rather than eighty-three zeroes dragging
 * the average down.
 */
export function sumDays(series: TradingDay[], { start, length }: Window): Totals {
  const days = series.slice(Math.max(0, start), Math.max(0, start) + Math.max(0, length));
  if (!days.length) return EMPTY_TOTALS;

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

export function periodFor(series: TradingDay[], window: Window): Period {
  const current = sumDays(series, window);
  const previous = sumDays(series, { start: window.start + current.days, length: current.days });
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
 * How far back the calendar may go.
 *
 * The oldest day the SERIES can answer for, rather than a fixed constant. It was
 * 200 — the length of the generated fixture — which on a real install would have
 * offered a shopkeeper ninety days of calendar for a store that opened last week.
 * A series with nothing in it still allows today, so the picker is never empty.
 */
export function seriesDays(series: TradingDay[]): number {
  return Math.max(1, series.length);
}

/**
 * A picked calendar range → a window on the series. Null while the pair is
 * incomplete or lands entirely outside the series, so the caller can hold the
 * numbers already on screen rather than flashing zeroed cards mid-pick.
 */
export function windowFromRange(series: TradingDay[], from?: Date, to?: Date): Window | null {
  if (!from || !to) return null;

  /* A bigger offset is an older day, so the newest end is the smaller one. */
  const newest = Math.max(0, Math.min(offsetOf(from), offsetOf(to)));
  const oldest = Math.min(seriesDays(series) - 1, Math.max(offsetOf(from), offsetOf(to)));
  if (oldest < newest) return null;

  return { start: newest, length: oldest - newest + 1 };
}

/** The inverse: the calendar range a window covers, so a preset fills the picker. */
export function rangeFromWindow({ start, length }: Window): { from: Date; to: Date } {
  return { from: daysBefore(start + length - 1), to: daysBefore(start) };
}

/** The oldest day the series can answer for — the calendar's floor. */
export function earliestDay(series: TradingDay[]): Date {
  return daysBefore(seriesDays(series) - 1);
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

/** Two digits, so a row of counts does not jump about as they change. */
export function pad(count: number): string {
  return String(count).padStart(2, "0");
}
