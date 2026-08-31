"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { useRegisterList } from "@/api/use-register";
import { adminClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import type { RecordRow } from "@/components/shell/record-manager";
import { refreshQueues } from "@/features/15-dashboard/dashboard-api";

/**
 * Orders and shipments, in one place, because they are one thing.
 *
 * They used to be two `localStorage` registers seeded from fixtures, which made
 * the rules between them unwritable in the only place they matter: cancelling an
 * order could not stop the parcel that order had already put on a van, because
 * the van was a fact about a browser. Worse, the whole register was fiction — a
 * shopper placing a real order through checkout wrote a row to `orders` that this
 * screen never showed, and an operator "confirming" an order confirmed nothing.
 *
 * Both lists are now read from the API, and every verb is one of its endpoints.
 * The rules live on the SERVER, where they belong and where they are safe:
 *
 *   cancel   → cancels any open parcel for that order AND releases the stock it
 *              was holding, in one transaction (`OrderConsoleService::cancel`)
 *   dispatch → refuses an unconfirmed order, refuses a second live parcel, and
 *              mints the shipment itself
 *
 * None of those are re-implemented here. A browser cannot hold a transaction
 * open, so a browser cannot be the thing that guarantees an order and its parcel
 * agree.
 *
 * Records stay flat string maps — the shape every register in this console uses —
 * because that is exactly what the console presenters return.
 */

const ORDERS = "/admin/orders";
const SHIPMENTS = "/admin/shipments";

/* ------------------------------------------------------------ the rules */

/**
 * The parcel actually carrying an order.
 *
 * A cancelled parcel is not carrying anything, so it only answers this when it
 * is all there is — which is what lets the order's record still show what was
 * attempted while the order itself goes back into the dispatch queue.
 */
export function shipmentForOrder(shipments: RecordRow[], orderId: string) {
  const mine = shipments.filter((shipment) => shipment.order === orderId);
  return mine.find((shipment) => shipment.status !== "Cancelled") ?? mine[0];
}

/** Live parcel or nothing — the question dispatch actually asks. */
function carrying(shipments: RecordRow[], orderId: string) {
  return shipments.find(
    (shipment) => shipment.order === orderId && shipment.status !== "Cancelled",
  );
}

/**
 * Confirmed orders that nothing is carrying yet — the work the shipments
 * screen offers to dispatch. An order whose parcel was called off is back in
 * this list, because it is still a confirmed order with nothing on the way.
 *
 * Kept as a client-side derivation rather than an endpoint because it is a
 * question about two lists this screen is already holding, and the server
 * re-checks it anyway when the dispatch is actually attempted.
 */
export function awaitingDispatch(orders: RecordRow[], shipments: RecordRow[]) {
  return orders.filter(
    (order) => order.status === "Confirmed" && !carrying(shipments, order.id),
  );
}

/* ------------------------------------------------------------- provider */

export type FulfilmentValue = {
  orders: RecordRow[];
  shipments: RecordRow[];
  /** False until both lists have been read once. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** Re-reads both. Every verb below does this for itself. */
  refresh: () => Promise<void>;
  /** Agrees an order is real. Rejected by the server if payment failed. */
  confirmOrder: (orderId: string) => Promise<void>;
  /**
   * Calls an order off, whoever asked. The server cancels any parcel still out
   * for it and releases its stock in the same transaction.
   */
  cancelOrder: (orderId: string, by: "Store" | "Customer") => Promise<void>;
  /** Puts a confirmed order on a van. The server mints the shipment. */
  dispatchOrder: (input: {
    orderId: string;
    provider: string;
    destination?: string;
  }) => Promise<void>;
  /** Moves a parcel on — `POST /admin/shipments/{id}/transition`. */
  transitionShipment: (
    shipmentId: string,
    status: string,
    extra?: Record<string, unknown>,
  ) => Promise<void>;
  /** Any other shipment verb: resend, return-to-store, arrived-back, refresh. */
  shipmentAction: (
    shipmentId: string,
    action: string,
    body?: Record<string, unknown>,
  ) => Promise<void>;
};

const FulfilmentContext = createContext<FulfilmentValue | null>(null);

export function FulfilmentProvider({ children }: { children: ReactNode }) {
  const orders = useRegisterList(ORDERS);
  const shipments = useRegisterList(SHIPMENTS);

  /* Both, after every verb. A cancel changes an order AND a shipment; a dispatch
     creates a shipment and moves an order out of the queue. Re-reading one would
     leave the other screen showing the state before the change. */
  const refresh = useCallback(async () => {
    /* The queue counts too, because they are what the rail's badges read: an
       order confirmed here leaves `ordersToConfirm` and joins `readyToDispatch`,
       and a badge that only updates on a reload is a badge nobody trusts. */
    await Promise.all([orders.refresh(), shipments.refresh(), refreshQueues()]);
  }, [orders, shipments]);

  const post = useCallback(
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

  const confirmOrder = useCallback(
    (orderId: string) => post(`${ORDERS}/${encodeURIComponent(orderId)}/confirm`),
    [post],
  );

  const cancelOrder = useCallback(
    (orderId: string, by: "Store" | "Customer") =>
      post(`${ORDERS}/${encodeURIComponent(orderId)}/cancel`, { by }),
    [post],
  );

  const dispatchOrder = useCallback(
    ({ orderId, provider, destination }: Parameters<FulfilmentValue["dispatchOrder"]>[0]) =>
      /* No client-side "is a parcel already out" check. The server refuses a
         second live parcel inside the transaction that would create it, which is
         the only place the answer cannot have changed since it was asked. */
      post(`${ORDERS}/${encodeURIComponent(orderId)}/dispatch`, {
        provider,
        ...(destination ? { destination } : {}),
      }),
    [post],
  );

  const transitionShipment = useCallback(
    (shipmentId: string, status: string, extra?: Record<string, unknown>) =>
      post(`${SHIPMENTS}/${encodeURIComponent(shipmentId)}/transition`, { status, ...extra }),
    [post],
  );

  const shipmentAction = useCallback(
    (shipmentId: string, action: string, body?: Record<string, unknown>) =>
      post(`${SHIPMENTS}/${encodeURIComponent(shipmentId)}/${action}`, body),
    [post],
  );

  const value = useMemo<FulfilmentValue>(
    () => ({
      orders: orders.rows,
      shipments: shipments.rows,
      ready: orders.loaded && shipments.loaded,
      loading: orders.loading || shipments.loading,
      error: orders.error ?? shipments.error,
      refresh,
      confirmOrder,
      cancelOrder,
      dispatchOrder,
      transitionShipment,
      shipmentAction,
    }),
    [
      cancelOrder,
      confirmOrder,
      dispatchOrder,
      orders,
      refresh,
      shipmentAction,
      shipments,
      transitionShipment,
    ],
  );

  return <FulfilmentContext.Provider value={value}>{children}</FulfilmentContext.Provider>;
}

export function useFulfilment() {
  const context = useContext(FulfilmentContext);
  if (!context) throw new Error("useFulfilment must be used inside FulfilmentProvider");
  return context;
}
