"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { RecordRow } from "@/components/admin/record-manager";
import { adminOrderFixtures } from "@/features/07-orders/data/admin-order-fixtures";
import { shipmentFixtures } from "@/features/17-shipping/data/shipment-fixtures";
import { createLocalStore } from "@/lib/local-store";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Orders and shipments, in one place, because they are one thing.
 *
 * They were two registers with two `useState` copies, which made the rules
 * between them unwritable: cancelling an order could not stop the parcel that
 * order had already put on a van, and the shipments screen had no way to know
 * which confirmed orders were still waiting to go out. Both screens read this
 * store now, so those rules live here — once — instead of being restated on
 * each screen and drifting apart.
 *
 * Records are flat string maps, the shape every register in this console uses,
 * so they drop straight into `RecordManager` without a mapping layer.
 */

type Fulfilment = { orders: RecordRow[]; shipments: RecordRow[] };

const STORAGE_KEY = "iced-out-fulfilment-v1";

const SEEDED: Fulfilment = {
  orders: adminOrderFixtures,
  shipments: shipmentFixtures,
};

/** Only flat string maps survive the trip back — anything else is not a record. */
function reviveList(value: unknown, fallback: RecordRow[]): RecordRow[] {
  if (!Array.isArray(value)) return fallback;

  const rows: RecordRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row: RecordRow = {};
    for (const [key, cell] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof cell === "string") row[key] = cell;
    }
    if (row.id) rows.push(row);
  }

  return rows;
}

const store = createLocalStore<Fulfilment>(STORAGE_KEY, SEEDED, (parsed, fallback) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const stored = parsed as Partial<Record<keyof Fulfilment, unknown>>;

  /* An emptied register is a legitimate state, so a missing key falls back to
     the seed but a present-and-empty one is honoured. */
  return {
    orders: "orders" in stored ? reviveList(stored.orders, []) : fallback.orders,
    shipments: "shipments" in stored ? reviveList(stored.shipments, []) : fallback.shipments,
  };
});

/* ------------------------------------------------------------ the rules */

/** A shipment that has already arrived or already failed is history. */
function isOpen(shipment: RecordRow) {
  return shipment.status !== "Delivered" && shipment.status !== "Cancelled";
}

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
  /** False until the browser's copy is the one on screen. */
  ready: boolean;
  commitOrders: (next: (current: RecordRow[]) => RecordRow[]) => void;
  commitShipments: (next: (current: RecordRow[]) => RecordRow[]) => void;
  /**
   * Calls an order off, whoever asked. A cancelled order cannot leave, so any
   * parcel still out for it is cancelled in the same write — the two can never
   * be seen disagreeing because they are never stored apart.
   */
  cancelOrder: (orderId: string, by: "Store" | "Customer") => void;
  /** Puts a confirmed order on a van, on the day the operator chose. */
  dispatchOrder: (input: {
    orderId: string;
    provider: string;
    dispatched: string;
    destination?: string;
  }) => void;
};

const FulfilmentContext = createContext<FulfilmentValue | null>(null);

export function FulfilmentProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();

  const commitOrders = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ ...current, orders: next(current.orders) });
  }, []);

  const commitShipments = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ ...current, shipments: next(current.shipments) });
  }, []);

  const cancelOrder = useCallback((orderId: string, by: "Store" | "Customer") => {
    const current = store.getSnapshot();
    store.write({
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: "Cancelled", cancelledBy: by } : order,
      ),
      shipments: current.shipments.map((shipment) =>
        shipment.order === orderId && isOpen(shipment)
          ? { ...shipment, status: "Cancelled" }
          : shipment,
      ),
    });
  }, []);

  const dispatchOrder = useCallback(
    ({ orderId, provider, dispatched, destination }: Parameters<FulfilmentValue["dispatchOrder"]>[0]) => {
      const current = store.getSnapshot();
      /* Only a LIVE parcel blocks a second one. An order whose first parcel
         was called off has to be sendable again, or it sits confirmed forever
         with nothing on the way to the customer. */
      if (carrying(current.shipments, orderId)) return;

      /* Where it is going is a fact about the ORDER, so the dispatch dialog
         does not ask for it a second time. */
      const order = current.orders.find((entry) => entry.id === orderId);

      /* The order's own number is what a person searches for, so the parcel is
         filed under it rather than under a counter nobody can join back — and
         a re-send takes the next free form of that number rather than
         colliding with the attempt it is replacing. */
      const base = `shp-${orderId.split("-").pop() ?? orderId}`;
      const taken = new Set(current.shipments.map((entry) => entry.id));
      let id = base;
      for (let attempt = 2; taken.has(id); attempt += 1) id = `${base}-${attempt}`;

      const shipment: RecordRow = {
        id,
        order: orderId,
        provider,
        awb: `••••${orderId.slice(-4)}`,
        destination: destination ?? order?.destination ?? "—",
        dispatched,
        status: "Dispatched",
      };

      store.write({ ...current, shipments: [shipment, ...current.shipments] });
    },
    [],
  );

  const value = useMemo(
    () => ({
      orders: state.orders,
      shipments: state.shipments,
      ready,
      commitOrders,
      commitShipments,
      cancelOrder,
      dispatchOrder,
    }),
    [cancelOrder, commitOrders, commitShipments, dispatchOrder, ready, state],
  );

  return <FulfilmentContext.Provider value={value}>{children}</FulfilmentContext.Provider>;
}

export function useFulfilment() {
  const context = useContext(FulfilmentContext);
  if (!context) throw new Error("useFulfilment must be used inside FulfilmentProvider");
  return context;
}
