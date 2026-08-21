"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { customerClient } from "@/api/clients";
import { createRemoteRecord } from "@/lib/remote-store";

/**
 * The shopper's own returns, read from the database.
 *
 * They used to come from `data/return-fixtures.ts` — two written-in records, the
 * same two for everybody. The console had its own fixture describing "the same"
 * returns from the other side, and the comment in that file said so; two files
 * agreeing with each other about a return that did not exist. A return an
 * operator approved was invisible to the person who raised it.
 *
 * `GET /me/returns` also carries the two vocabularies the wizard needs — the
 * reasons and the outcomes — because both are settings the console owns. A reason
 * added there reaches the wizard without a deploy, and the wizard cannot offer one
 * the server would refuse.
 */

/** One return as `ReturnPresenter::customerRow` gives it. */
export type CustomerReturn = {
  id: string;
  order: string;
  item: string;
  variant: string;
  outcome: string;
  /** Whole rupees — the exchange arithmetic does sums with it. */
  amount: number;
  /** The item going out instead. Empty on anything but an exchange. */
  replacement: string;
  /** Where the value lands — a voucher code, once one has been issued. */
  destination: string;
  status: string;
  reference: string;
};

type Payload = {
  returns: CustomerReturn[];
  reasons: string[];
  outcomes: string[];
};

const record = createRemoteRecord<Payload>(async () => {
  const response = await customerClient.get<{ data: Payload }>("/me/returns");
  return response.data.data;
});

export type CustomerReturns = {
  returns: CustomerReturn[];
  /** Why an item can be sent back — the console's vocabulary. */
  reasons: string[];
  /** What the shopper can ask for instead — voucher or exchange. */
  outcomes: string[];
  /** False until the endpoint has answered. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Raises one.
   *
   * The amount is deliberately not a parameter: what the return is worth is the
   * order line's own price, which the server reads. A figure sent from here would
   * let a shopper name their own refund.
   */
  raise: (input: {
    order: string;
    item: string;
    reason: string;
    outcome: string;
    replacement?: string;
    pickup?: string;
  }) => Promise<CustomerReturn>;
};

/**
 * @param enabled false while nobody is signed in — the endpoint needs a session,
 *   and asking without one is a 401 on every page load.
 */
export function useCustomerReturns(enabled = true): CustomerReturns {
  /* Reading the snapshot is what starts the request, so a signed-out visitor is
     handed the server snapshot instead and nothing is asked for. */
  const state = useSyncExternalStore(
    record.subscribe,
    enabled ? record.getSnapshot : record.getServerSnapshot,
    record.getServerSnapshot,
  );

  const refresh = useCallback(async () => {
    if (enabled) await record.reload();
  }, [enabled]);

  const raise = useCallback<CustomerReturns["raise"]>(async (input) => {
    const response = await customerClient.post<{ data: CustomerReturn }>("/me/returns", {
      order: input.order,
      item: input.item,
      reason: input.reason,
      outcome: input.outcome,
      ...(input.replacement ? { replacement: input.replacement } : {}),
      ...(input.pickup ? { pickup: input.pickup } : {}),
    });

    /* Re-read, so what the confirmation quotes is the record the server wrote —
       including the reference and the id, which it mints. */
    await record.reload();

    return response.data.data;
  }, []);

  return useMemo(
    () => ({
      returns: state.data?.returns ?? [],
      reasons: state.data?.reasons ?? [],
      outcomes: state.data?.outcomes ?? [],
      ready: state.loaded,
      loading: state.loading,
      error: state.error,
      refresh,
      raise,
    }),
    [raise, refresh, state],
  );
}

/** Drops the held list. Called on sign-out. */
export function resetCustomerReturns() {
  record.reset();
}
