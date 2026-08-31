"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createRemoteRecord, createRemoteStore, type RemoteStore } from "@/lib/remote-store";

/**
 * What the landing screen and the analytics page put numbers on, read from the
 * database.
 *
 * All of this used to be computed in the browser from fixture arrays, and one of
 * those fixtures deserves naming: `trading-series.ts` GENERATED two hundred days
 * of revenue from a hash of the day's offset. It was honest about being a
 * generator, and it was reproducible, but it meant the dashboard's revenue chart
 * was a decoration — the number moved when the code changed, not when the store
 * traded.
 *
 * These five endpoints are the real thing:
 *
 *   /admin/dashboard/summary   today's revenue, orders, sessions, returns
 *   /admin/dashboard/trading   the day series, as offsets back from today
 *   /admin/dashboard/queues    the six counts, with the note each one needs
 *   /admin/dashboard/activity  what the console has actually been doing
 *   /admin/dashboard/pulse     the signals behind the bell
 *
 * A fresh install answers all of them with zeroes and empty lists, which is
 * correct: a store that has not traded has not traded.
 */

/** One day of trading. `offset` 0 is today, 1 is yesterday, counting backwards. */
export type TradingDay = {
  offset: number;
  revenue: number;
  orders: number;
  sessions: number;
  returns: number;
};

export type QueueCount = { count: number; note: string };

/** The six queue cards, keyed as `DashboardPresenter::queues` returns them. */
export type Queues = {
  ordersToConfirm: QueueCount;
  paymentExceptions: QueueCount;
  readyToDispatch: QueueCount;
  returnsToReview: QueueCount;
  stockAtRisk: QueueCount;
  openTickets: QueueCount;
};

export type LogEntry = {
  id: string;
  source: string;
  action: string;
  title: string;
  detail: string;
  actor: string;
  state: string;
  tone: string;
  /** Seconds since it happened, as of the response. */
  offset: number;
  /** When it happened, in epoch milliseconds. */
  born: number;
};

export type Signal = {
  id: string;
  kind: string;
  tone: string;
  title: string;
  detail: string;
  href: string;
  offset: number;
  born: number;
};

/** An unread register answers with nothing rather than with a guess. */
const EMPTY_QUEUES: Queues = {
  ordersToConfirm: { count: 0, note: "" },
  paymentExceptions: { count: 0, note: "" },
  readyToDispatch: { count: 0, note: "" },
  returnsToReview: { count: 0, note: "" },
  stockAtRisk: { count: 0, note: "" },
  openTickets: { count: 0, note: "" },
};

/**
 * The queue counts.
 *
 * A single object rather than a list, so it goes through `createRemoteRecord` —
 * same contract, same dedupe, and the same reason as the others: subscribing to a
 * store keeps the load out of an effect body.
 */
const queuesRecord = createRemoteRecord<Queues>(async () => {
  const response = await adminClient.get<{ data: Queues }>("/admin/dashboard/queues");
  return response.data.data;
});

/**
 * Lists go through `createRemoteStore`, so two screens reading the trading series
 * — the dashboard and the analytics page — share one request.
 *
 * These three endpoints NEST their list under a name (`series`, `entries`,
 * `signals`) rather than answering with a bare array, unlike the console's
 * registers. Unwrapped here, once, so nothing downstream has to know which shape
 * a given endpoint uses.
 */
const tradingStore: RemoteStore<TradingDay> = createRemoteStore(async () => {
  const response = await adminClient.get<{ data: { series: TradingDay[] } }>(
    "/admin/dashboard/trading",
  );
  return response.data.data.series ?? [];
});

const activityStore: RemoteStore<LogEntry> = createRemoteStore(async () => {
  const response = await adminClient.get<{ data: { entries: LogEntry[] } }>(
    "/admin/dashboard/activity",
  );
  return response.data.data.entries ?? [];
});

const pulseStore: RemoteStore<Signal> = createRemoteStore(async () => {
  const response = await adminClient.get<{ data: { signals: Signal[] } }>(
    "/admin/dashboard/pulse",
  );
  return response.data.data.signals ?? [];
});

/**
 * The day series, newest first.
 *
 * Sorted here rather than trusted from the wire: every window calculation
 * downstream indexes into this by offset, so an out-of-order row would silently
 * put the wrong day in the wrong period.
 */
export function useTrading() {
  const state = useSyncExternalStore(
    tradingStore.subscribe,
    tradingStore.getSnapshot,
    tradingStore.getServerSnapshot,
  );

  const series = useMemo(
    () => [...state.data].sort((a, b) => a.offset - b.offset),
    [state.data],
  );

  return { series, loading: state.loading, error: state.error, loaded: state.loaded };
}

export function useQueues() {
  const state = useSyncExternalStore(
    queuesRecord.subscribe,
    queuesRecord.getSnapshot,
    queuesRecord.getServerSnapshot,
  );

  return {
    /* Zeroes rather than null, so every caller can read `queues.ordersToConfirm`
       without a guard while the first request is out. `loaded` is what tells an
       unread register from an empty one. */
    queues: state.data ?? EMPTY_QUEUES,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
  };
}

/** Re-reads the queue counts — after a verb that clears one. */
export function refreshQueues() {
  return queuesRecord.reload();
}

/**
 * The activity log, re-read on an interval.
 *
 * It used to MINT a synthetic line every fifteen seconds from a generator, which
 * is why the feed kept moving on an idle console: it was not reporting work, it
 * was manufacturing it. Now it asks the server what has happened.
 *
 * It still idles when the tab is hidden, for the reason it always did — nobody is
 * reading it — and now with a second one: a background tab polling forever is a
 * request every few seconds for a screen nobody is looking at.
 */
export function useActivity({ pollSeconds = 20 }: { pollSeconds?: number } = {}) {
  const state = useSyncExternalStore(
    activityStore.subscribe,
    activityStore.getSnapshot,
    activityStore.getServerSnapshot,
  );

  const [watching, setWatching] = useState(true);

  useEffect(() => {
    const onVisibility = () => setWatching(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* The timer calls the STORE directly rather than a callback captured from the
     render. There is nothing to go stale — `activityStore` is a module singleton —
     so no ref is needed, which is just as well: writing one during a render is
     something this repo lints against, and correctly. */
  useEffect(() => {
    if (!watching) return;

    const timer = setInterval(() => void activityStore.refresh(), pollSeconds * 1_000);
    return () => clearInterval(timer);
  }, [pollSeconds, watching]);

  const refresh = useCallback(() => activityStore.refresh(), []);

  return {
    entries: state.data,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    refresh,
  };
}

export function usePulse() {
  const state = useSyncExternalStore(
    pulseStore.subscribe,
    pulseStore.getSnapshot,
    pulseStore.getServerSnapshot,
  );

  return {
    signals: state.data,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    refresh: () => pulseStore.refresh(),
  };
}

/** Drops the held dashboard data. Called on staff sign-out. */
export function resetDashboard() {
  void queuesRecord.reload();
  tradingStore.reset();
  activityStore.reset();
  pulseStore.reset();
}
