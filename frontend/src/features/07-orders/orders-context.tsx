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

import { formatPrice } from "@/features/02-products";
import type { CartLine } from "@/types/commerce";
import {
  orderFixtures,
  type OrderFixture,
  type OrderLineFixture,
  type OrderPaymentStatus,
} from "@/features/07-orders/data/order-fixtures";
import {
  reservedOrderSlots,
  trackingTokenForSlot,
} from "@/features/07-orders/data/order-slots";
import { recordCheckoutPayment } from "@/features/09-payment/payment-store";

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

const ORDERS_KEY = "iced-out.orders";

/** The seeded orders, lifted into the shape the store hands out. */
const seeded: OrderRecord[] = orderFixtures.map((order) => ({
  ...order,
  placedAt: 0,
  local: false,
}));

function readOrders(): OrderRecord[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ORDERS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): OrderRecord[] => {
      const order = entry as Partial<OrderRecord>;
      // The three fields every surface addresses an order by. A half-written
      // record drops out rather than reaching a screen as a hole.
      if (typeof order.id !== "string") return [];
      if (typeof order.number !== "string") return [];
      if (!Array.isArray(order.lines)) return [];
      return [{ ...(order as OrderRecord), local: true }];
    });
  } catch {
    return [];
  }
}

function writeOrders(orders: OrderRecord[]) {
  try {
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    /* the order still shows for this tab; only the archive is lost */
  }
}

/** `04 Aug 2026` — the format the fixtures already print. */
function formatOrderDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

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
  placeOrder: (input: PlaceOrderInput) => OrderRecord;
  /** A second attempt at a payment that failed, settled onto the same order. */
  settlePayment: (
    orderId: string,
    payment: { method: string; reference: string; outcome: PaymentOutcome; note?: string },
  ) => void;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [placed, setPlaced] = useState<OrderRecord[]>([]);
  const [restored, setRestored] = useState(false);

  /* `placeOrder` has to hand the finished record back to its caller so payment
     has somewhere to send the shopper. A `setState` updater cannot supply that
     — React runs it when it renders, not when it is called — so the archive is
     mirrored here and the new order is built against the mirror.
     Written only where the list actually changes (the restore below and
     `placeOrder`), never during a render. */
  const archive = useRef<OrderRecord[]>([]);

  /* Read after mount, never during render: the markup React hydrates was
     exported with no local orders in it, and seeding from storage during the
     first render makes the two disagree. */
  useEffect(() => {
    const stored = readOrders();
    archive.current = stored;
    setPlaced(stored);
    setRestored(true);
  }, []);

  /* `restored` is load-bearing — without it the first render writes its empty
     initial state straight over the stored archive. */
  useEffect(() => {
    if (!restored) return;
    writeOrders(placed);
  }, [placed, restored]);

  const orders = useMemo(
    () => [...placed].sort((a, b) => b.placedAt - a.placedAt).concat(seeded),
    [placed],
  );

  const findOrder = useCallback(
    (idOrNumber: string) =>
      orders.find((order) => order.id === idOrNumber || order.number === idOrNumber),
    [orders],
  );

  const placeOrder = useCallback((input: PlaceOrderInput) => {
    const { lines, contact, address, delivery, payment, money } = input;
    const now = new Date();

    const orderLines: OrderLineFixture[] = lines.map((line, index) => ({
      id: `line-${now.getTime()}-${index}`,
      name: line.product.name,
      variant: `${line.product.color} / ${line.size}`,
      quantity: line.quantity,
      price: formatPrice(line.product.price * line.quantity),
      // A return is opened against a delivered piece; nothing is returnable
      // the minute it is bought, and saying otherwise offers a door that
      // leads nowhere.
      returnEligible: false,
    }));

    /* Ids and numbers both come off the existing archive so two orders placed
       in the same second can never collide. */
    const current = archive.current;
    const taken = new Set(current.map((order) => order.id));
    const freeSlot = reservedOrderSlots.find((slot) => !taken.has(slot));

    // Every slot spoken for: the oldest local order gives its id back. The pool
    // is exactly what the static export can address, so it cannot simply grow.
    const oldest = [...current].sort((a, b) => a.placedAt - b.placedAt)[0];
    const id = freeSlot ?? oldest?.id ?? reservedOrderSlots[0];
    const kept = freeSlot ? current : current.filter((order) => order.id !== id);

    const highest = [...kept, ...seeded].reduce((running, order) => {
      const serial = Number(order.number.split("-").at(-1));
      return Number.isFinite(serial) && serial > running ? serial : running;
    }, 1048);

    const failed = payment.outcome === "failed";

    const order: OrderRecord = {
      id,
      number: `IO-${now.getFullYear()}-${highest + 1}`,
      date: formatOrderDate(now),
      total: formatPrice(money.total),
      // An order whose payment bounced is not "Processing" — nothing is being
      // processed until the money is there, and saying otherwise is what makes
      // a shopper stop checking their card.
      status: failed ? "Payment failed" : "Processing",
      items: orderLines.map((line) => line.name).join(" · "),
      lines: orderLines,
      payment: {
        method: payment.method,
        // Cash on delivery is a real order with no money taken yet, and the
        // receipt has to say which of the three it is.
        status: PAYMENT_STATUS[payment.outcome],
        reference: payment.reference,
        note: payment.note,
      },
      shipment: {
        // Paired with the slot, so the public tracking page for this order is
        // one the static export has already written out.
        token: trackingTokenForSlot(id),
        service: delivery.label,
        awb: failed
          ? "Held until payment clears"
          : payment.outcome === "captured"
            ? "Assigned at dispatch"
            : "Assigned on confirmation",
        destination: `${address.city}, ${address.state}`,
        estimate: delivery.estimate,
      },
      cancellationEligible: true,
      placedAt: now.getTime(),
      local: true,
      contact,
      address,
      money: { ...money, delivery: delivery.fee },
    };

    archive.current = [order, ...kept];
    setPlaced(archive.current);

    /* And into the console's ledger, so the back office sees the money the
       moment the shopper does. A payment nobody there can see is not a payment
       that happened: support cannot answer for it and nothing will reconcile
       it. Cash on delivery records nothing — the writer knows which outcomes
       are money, so neither caller has to. */
    recordCheckoutPayment({
      order: order.number,
      customer: contact.name,
      amount: money.total,
      method: payment.method,
      reference: payment.reference,
      outcome: payment.outcome,
      note: payment.note,
    });

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

      /* A second attempt is a second entry in the ledger, never an edit of the
         first: what the gateway did on Tuesday is still what it did on Tuesday
         once Wednesday's attempt succeeds. */
      if (settles && before.money) {
        recordCheckoutPayment({
          order: before.number,
          customer: before.contact?.name ?? "",
          amount: before.money.total,
          method: payment.method,
          reference: payment.reference,
          outcome: payment.outcome,
          note: payment.note,
        });
      }
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
