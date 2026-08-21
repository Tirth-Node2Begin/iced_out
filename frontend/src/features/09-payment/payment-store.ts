"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import type { RecordRow } from "@/components/admin/record-manager";
import { refreshQueues } from "@/features/15-dashboard/dashboard-api";
import { createRemoteStore, type RemoteStore } from "@/lib/remote-store";

/**
 * The money ledger — payments, refunds and payouts, read from the database.
 *
 * This was a `localStorage` ledger with a comment explaining that keeping it
 * there was what let checkout and the back office see the same payments. They
 * did, within one browser. The deeper problem was that the write was a DUPLICATE:
 * `POST /checkout/orders` already inserts the payment row inside the same
 * transaction as the order (see `PlaceOrderService`), so every purchase was
 * recorded twice — once in the database, where the console could not see it, and
 * once in the browser, where nobody else could.
 *
 * `recordCheckoutPayment` is therefore gone rather than rewritten. Checkout does
 * not need to tell the ledger anything; placing the order IS the entry.
 *
 * Three registers, three endpoints:
 *
 *   /admin/payments   every attempt, captured, due or failed
 *   /admin/refunds    what has been sent back, and what is waiting on approval
 *   /admin/payouts    what the gateway has settled to the bank
 *
 * Nothing here is editable. A ledger is a record of what happened; the verbs it
 * offers are `collect-cod`, `gateway-check`, a refund transition and marking a
 * payout paid — each of which records a new fact rather than amending an old one.
 */

const paymentsStore: RemoteStore<RecordRow> = remote("/admin/payments");
const refundsStore: RemoteStore<RecordRow> = remote("/admin/refunds");
const payoutsStore: RemoteStore<RecordRow> = remote("/admin/payouts");

function remote(path: string): RemoteStore<RecordRow> {
  return createRemoteStore<RecordRow>(async () => {
    const response = await adminClient.get<{ data: RecordRow[] }>(path);
    return response.data.data;
  });
}

export type PaymentLedger = {
  payments: RecordRow[];
  refunds: RecordRow[];
  payouts: RecordRow[];
  /** False until all three have answered once. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** Re-reads all three. A refund changes a payment's standing, and a payout's. */
  refresh: () => Promise<void>;
  /**
   * A verb on one row.
   *
   * `idempotent` marks the ones that move money — collecting cash on delivery,
   * raising a refund — so a retry on a slow connection replays the first request
   * instead of taking the money twice. The API enforces it against the key; this
   * is the half that sends one.
   */
  act: (path: string, body?: Record<string, unknown>, idempotent?: boolean) => Promise<void>;
  /** Raises a refund against a payment. Its own endpoint, and replay-safe. */
  raiseRefund: (input: {
    payment: string;
    amount: number;
    reason: string;
  }) => Promise<void>;
};

export function usePaymentLedger(): PaymentLedger {
  const payments = useSyncExternalStore(
    paymentsStore.subscribe,
    paymentsStore.getSnapshot,
    paymentsStore.getServerSnapshot,
  );
  const refunds = useSyncExternalStore(
    refundsStore.subscribe,
    refundsStore.getSnapshot,
    refundsStore.getServerSnapshot,
  );
  const payouts = useSyncExternalStore(
    payoutsStore.subscribe,
    payoutsStore.getSnapshot,
    payoutsStore.getServerSnapshot,
  );

  const refresh = useCallback(async () => {
    /* The queue counts too — `paymentExceptions` is what the rail badges on the
       Payments lane, and collecting a cash payment clears one. */
    await Promise.all([
      paymentsStore.refresh(),
      refundsStore.refresh(),
      payoutsStore.refresh(),
      refreshQueues(),
    ]);
  }, []);

  const act = useCallback(
    async (path: string, body?: Record<string, unknown>, idempotent = false) => {
      await adminClient.post(
        path,
        body ?? {},
        idempotent
          ? { headers: { "Idempotency-Key": createIdempotencyKey(path) } }
          : undefined,
      );
      await refresh();
    },
    [refresh],
  );

  const raiseRefund = useCallback(
    (input: { payment: string; amount: number; reason: string }) =>
      act("/admin/refunds", input, true),
    [act],
  );

  return useMemo(
    () => ({
      payments: payments.data,
      refunds: refunds.data,
      payouts: payouts.data,
      ready: payments.loaded && refunds.loaded && payouts.loaded,
      loading: payments.loading || refunds.loading || payouts.loading,
      error: payments.error ?? refunds.error ?? payouts.error,
      refresh,
      act,
      raiseRefund,
    }),
    [act, payments, payouts, raiseRefund, refresh, refunds],
  );
}

/** Drops the held ledger. Called on staff sign-out. */
export function resetPaymentLedger() {
  paymentsStore.reset();
  refundsStore.reset();
  payoutsStore.reset();
}
