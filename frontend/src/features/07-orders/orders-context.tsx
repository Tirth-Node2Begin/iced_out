"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { customerClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import type { CartLine } from "@/types/commerce";
import {
  type OrderFixture,
  type OrderPaymentStatus,
} from "@/features/07-orders/data/order-fixtures";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * Every order the app can show, from both directions.
 *
 * The two seeded orders are fixtures compiled into the bundle. An order placed
 * at checkout is written here, and from that moment the archive, the account
 * overview, the rail count and the order screen all read it from ONE list —
 * which is the only way the number on the profile can be trusted to match the
 * rows under it.
 *
 * An order is a SNAPSHOT, so unlike the bag (which stores identities and looks
 * the product up again so it can never quote a stale price) this stores the
 * finished record verbatim. That is the point of an order: the price, the name
 * and the variant it was bought at survive the catalogue moving on.
 */

/** A record that also carries what a placed order knows and a fixture cannot. */
export type OrderRecord = OrderFixture & {
  /** epoch ms — fixtures sort below anything actually placed on this device */
  placedAt: number;
  /** true for an order placed in this browser, false for a seeded fixture */
  local: boolean;
  contact?: { name: string; email: string; mobile: string };
  address?: { line: string; city: string; state: string; postalCode: string };
  /** the numbers behind the formatted strings, so a receipt can re-add them */
  money?: {
    subtotal: number;
    discount: number;
    delivery: number;
    total: number;
    couponCode: string | null;
  };
};

/* The seeded fixtures and the localStorage archive that used to back this store
   are gone. Orders belong to an account, not to a browser: they are read from
   `GET /me/orders`, so a new account has none and two people on the same
   machine never see each other's purchases. */

/**
 * How an order was paid for, in the three states checkout can produce.
 *
 * `captured` — the gateway confirmed, or the card was authorised.
 * `due`      — cash on delivery: a real order, no money moved yet.
 * `failed`   — the gateway declined, or the shopper closed it. The order is
 *              still written; see `OrderPaymentStatus`.
 */
export type PaymentOutcome = "captured" | "due" | "failed";

const PAYMENT_STATUS: Record<PaymentOutcome, OrderPaymentStatus> = {
  captured: "Captured",
  due: "Due on delivery",
  failed: "Failed",
};

export type PlaceOrderInput = {
  lines: CartLine[];
  contact: { name: string; email: string; mobile: string };
  address: { line: string; city: string; state: string; postalCode: string };
  delivery: { label: string; estimate: string; fee: number };
  payment: { method: string; reference: string; outcome: PaymentOutcome; note?: string };
  money: { subtotal: number; discount: number; total: number; couponCode: string | null };
};

type OrdersContextValue = {
  /** placed orders newest-first, then the seeded ones */
  orders: OrderRecord[];
  /** false until storage has been read — see the write effect */
  restored: boolean;
  findOrder: (idOrNumber: string) => OrderRecord | undefined;
  placeOrder: (input: PlaceOrderInput) => Promise<OrderRecord>;
  /** A second attempt at a payment that failed, settled onto the same order. */
  settlePayment: (
    orderId: string,
    payment: { method: string; reference: string; outcome: PaymentOutcome; note?: string },
  ) => void;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, sessionReady } = useAuth();
  const [placed, setPlaced] = useState<OrderRecord[]>([]);
  const [restored, setRestored] = useState(false);

  /* `placeOrder` has to hand the finished record back to its caller so payment
     has somewhere to send the shopper. A `setState` updater cannot supply that
     — React runs it when it renders, not when it is called — so the archive is
     mirrored here and the new order is built against the mirror.
     Written only where the list actually changes (the restore below and
     `placeOrder`), never during a render. */
  const archive = useRef<OrderRecord[]>([]);

  /**
   * The account's real orders, read from the API.
   *
   * They used to come from `localStorage` seeded with two demo orders, so every
   * browser — including one that had just registered — opened onto somebody
   * else's purchase history. Orders belong to an account: a new one has none,
   * and what shows here is what the database holds for whoever is signed in.
   */
  const [mine, setMine] = useState<OrderRecord[]>([]);

  useEffect(() => {
    if (!sessionReady) return;

    let live = true;

    async function load() {
      if (!isAuthenticated) {
        if (live) {
          setMine([]);
          setRestored(true);
        }

        return;
      }

      try {
        const response = await customerClient.get<{ data: OrderRecord[] }>("/me/orders");
        if (live) setMine(response.data.data);
      } catch {
        if (live) setMine([]);
      } finally {
        if (live) setRestored(true);
      }
    }

    void load();

    return () => {
      live = false;
    };
  }, [isAuthenticated, sessionReady]);

  /* An order placed in this tab is shown immediately so the confirmation screen
     has something to open, and the server's copy replaces it on the next read.
     Nothing is written to storage: an order is not a fact about a browser. */
  const orders = useMemo(
    () => [...placed].sort((a, b) => b.placedAt - a.placedAt).concat(mine),
    [mine, placed],
  );

  const findOrder = useCallback(
    (idOrNumber: string) =>
      orders.find((order) => order.id === idOrNumber || order.number === idOrNumber),
    [orders],
  );

  /**
   * Places the order on the SERVER, and returns what the server wrote.
   *
   * Everything that decides whether the order may exist — the prices, the
   * stock, the coupon, the id and the order number — is the API's to compute.
   * This used to mint all of it in the browser, which is why an order a shopper
   * could see in their account never appeared in the console: it had never
   * existed anywhere but this tab.
   *
   * The idempotency key is what makes a double-tap on a slow connection safe:
   * the second request replays the first order rather than buying the bag twice.
   */
  const placeOrder = useCallback(async (input: PlaceOrderInput): Promise<OrderRecord> => {
    const { lines, contact, address, delivery, payment, money } = input;

    const response = await customerClient.post<{ data: OrderFixture }>(
      "/checkout/orders",
      {
        lines: lines.map((line) => ({
          productId: line.product.id,
          size: line.size,
          quantity: line.quantity,
        })),
        contact,
        address,
        delivery: {
          id: /express/i.test(delivery.label) ? "express" : "standard",
          label: delivery.label,
          estimate: delivery.estimate,
          fee: delivery.fee,
        },
        payment,
        money,
      },
      { headers: { "Idempotency-Key": createIdempotencyKey("place-order") } },
    );

    const order: OrderRecord = {
      ...response.data.data,
      placedAt: Date.now(),
      local: true,
      contact,
      address,
      money: { ...money, delivery: delivery.fee },
    };

    /* Shown at once so the confirmation screen has something to open; the
       server's copy replaces it on the next read of /me/orders. */
    archive.current = [order, ...archive.current];
    setPlaced(archive.current);

    return order;
  }, []);

  /**
   * A retried payment landing on an order that already exists.
   *
   * Only ever moves an order OUT of "Payment failed" — a captured payment is
   * final as far as this screen is concerned, and letting a stale retry write
   * over it is how a paid order ends up displaying as unpaid.
   */
  const settlePayment = useCallback<OrdersContextValue["settlePayment"]>(
    (orderId, payment) => {
      /* Read before the write, so the ledger below applies the same rule the
         map does: a retry landing on an already-captured order changes nothing
         and records nothing. */
      const before = archive.current.find((order) => order.id === orderId);
      const settles = before !== undefined && before.payment.status !== "Captured";

      const next = archive.current.map((order) => {
        if (order.id !== orderId) return order;
        if (order.payment.status === "Captured") return order;

        const failed = payment.outcome === "failed";
        return {
          ...order,
          status: failed ? "Payment failed" : "Processing",
          payment: {
            method: payment.method,
            status: PAYMENT_STATUS[payment.outcome],
            reference: payment.reference,
            note: payment.note,
          },
          shipment: {
            ...order.shipment,
            awb: failed ? "Held until payment clears" : "Assigned at dispatch",
          },
        } satisfies OrderRecord;
      });

      archive.current = next;
      setPlaced(next);

      /* No ledger write here any more, and its absence is the point: the payment
         row is inserted by the SERVER, in the same transaction as the order (see
         `PlaceOrderService`). This used to also write a copy into a localStorage
         ledger, so every purchase was recorded twice — once where the console
         could not see it and once where nobody else could.

         `settles` and `before` are still read above, because the rule they encode
         still holds: a retry landing on an already-captured order changes nothing. */
      void settles;
      void before;
    },
    [],
  );

  const value = useMemo(
    () => ({ orders, restored, findOrder, placeOrder, settlePayment }),
    [findOrder, orders, placeOrder, restored, settlePayment],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used inside OrdersProvider");
  return context;
}
