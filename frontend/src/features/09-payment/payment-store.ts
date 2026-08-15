"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { RecordRow } from "@/components/admin/record-manager";
import {
  maskName,
  payments,
  payouts,
  refunds,
  stampNow,
} from "@/features/09-payment/payment-data";
import { isReservedPayment, reservedPaymentSlots } from "@/features/09-payment/payment-slots";
import { createLocalStore } from "@/lib/local-store";

/**
 * The ledger the two sides of the app share.
 *
 * The registers used to hold their rows in a `useState` seeded from fixtures,
 * which made this module a demonstration rather than a ledger: a shopper could
 * pay at checkout and nobody in the back office would ever see it, and an
 * operator's own edits died on the next navigation.
 *
 * One store fixes both. Checkout writes a payment here the moment the money
 * moves — see `recordCheckoutPayment` — and `/admin/payments` reads it, so the
 * ledger is the same list from either direction.
 *
 * There is no provider: the store is a module singleton, so the storefront can
 * write to it without the admin console being mounted, and the admin console
 * can read it without checkout being mounted. Neither side imports the other.
 */

type Ledger = { payments: RecordRow[]; refunds: RecordRow[]; payouts: RecordRow[] };

/**
 * Bumped from v1 when `Review` left the vocabulary. A ledger written under the
 * old words would come back holding a state no chip filters and no row action
 * can clear, which is worse than starting from the seed — the states ARE the
 * schema here, so a change to them is a change of shape.
 */
const STORAGE_KEY = "iced-out-payments-v2";

const SEEDED: Ledger = { payments, refunds, payouts };

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

const store = createLocalStore<Ledger>(STORAGE_KEY, SEEDED, (parsed, fallback) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const stored = parsed as Partial<Record<keyof Ledger, unknown>>;

  /* An emptied register is a legitimate state, so a missing key falls back to
     the seed but a present-and-empty one is honoured. */
  return {
    payments: "payments" in stored ? reviveList(stored.payments, []) : fallback.payments,
    refunds: "refunds" in stored ? reviveList(stored.refunds, []) : fallback.refunds,
    payouts: "payouts" in stored ? reviveList(stored.payouts, []) : fallback.payouts,
  };
});

/* ------------------------------------------------------- what checkout sends */

/** A payment as the storefront knows it, at the moment it settles. */
export type CheckoutPayment = {
  /** The order's public number, `IO-2026-1049` — what both sides call it. */
  order: string;
  /** The shopper's name as typed. Masked before it is written. */
  customer: string;
  amount: number;
  /** How they paid, in the storefront's words: `UPI ••••42`, `Visa •••• 1842`. */
  method: string;
  /** Whatever the gateway handed back. A `pay_…` id becomes the ledger's id. */
  reference: string;
  outcome: "captured" | "due" | "failed";
  note?: string;
};

/**
 * The id the new payment takes, and the rows that survive it.
 *
 * A slot out of the exported pool, so the payment has a detail page to open —
 * see `payment-slots`. When every slot is spoken for the oldest browser-made
 * payment gives its id back, exactly as a placed order does: the pool is
 * precisely what the static export can address, so it cannot simply grow.
 */
function claimSlot(rows: RecordRow[]) {
  const taken = new Set(rows.map((row) => row.id));
  const free = reservedPaymentSlots.find((slot) => !taken.has(slot));
  if (free) return { id: free, kept: rows };

  const oldest = [...rows].reverse().find((row) => isReservedPayment(row.id));
  const id = oldest?.id ?? reservedPaymentSlots[0];
  return { id, kept: rows.filter((row) => row.id !== id) };
}

/** Who took the money, read off how it was paid. */
function gatewayFor(outcome: CheckoutPayment["outcome"], method: string) {
  /* Cash on delivery is collected at the door, so the courier IS the gateway. */
  if (outcome === "due") return "Courier";
  if (/razorpay/i.test(method)) return "Razorpay";
  /* The card sheet authorises on this origin with no acquirer behind it. */
  return "On device";
}

/** The ledger's word for what the storefront just saw happen. */
const STATE: Record<CheckoutPayment["outcome"], string> = {
  captured: "Captured",
  due: "Due",
  failed: "Failed",
};

/** What the row says happened, when the gateway gave no words of its own. */
const DEFAULT_NOTE: Record<CheckoutPayment["outcome"], string> = {
  captured: "Taken at checkout",
  due: "The courier collects it at the door",
  failed: "The attempt did not go through",
};

/**
 * A payment from checkout, into the ledger the console reads.
 *
 * Every order writes one, because every order is money owed:
 *
 *   - paid by card or gateway → `Captured`, or `Failed` if it bounced;
 *   - cash on delivery        → `Due`, until someone marks it collected.
 *
 * A failed attempt is recorded rather than dropped. The shopper saw it, the
 * order exists carrying it, and support will be asked about it — a ledger that
 * only holds the money that arrived cannot answer "what happened to mine".
 */
export function recordCheckoutPayment(input: CheckoutPayment) {
  const current = store.getSnapshot();
  const { id, kept } = claimSlot(current.payments);

  const row: RecordRow = {
    id,
    order: input.order,
    customer: maskName(input.customer),
    gateway: gatewayFor(input.outcome, input.method),
    method: input.method,
    amount: String(Math.round(input.amount)),
    status: STATE[input.outcome],
    /* What the shopper was told, wherever there was something to tell them —
       so the row and the receipt cannot give two accounts of the same event. */
    note: input.note?.trim() || DEFAULT_NOTE[input.outcome],
    /* The gateway's own id, kept as evidence rather than used as the route — a
       payment support is asked about is looked up by this. Cash on delivery
       has none: no gateway was asked, so there is nothing to quote. */
    reference: input.outcome === "due" ? "" : input.reference,
    created: stampNow(),
  };

  store.write({ ...current, payments: [row, ...kept] });
}

/* --------------------------------------------------------- what admin reads */

export type PaymentLedger = Ledger & {
  commitPayments: (next: (current: RecordRow[]) => RecordRow[]) => void;
  commitRefunds: (next: (current: RecordRow[]) => RecordRow[]) => void;
  commitPayouts: (next: (current: RecordRow[]) => RecordRow[]) => void;
};

export function usePaymentLedger(): PaymentLedger {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  /* Each takes an updater rather than a list because an undo can fire long
     after the render that offered it, and it still has to build on what is
     current — which the store, not the closure, knows. */
  const commitPayments = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ ...current, payments: next(current.payments) });
  }, []);

  const commitRefunds = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ ...current, refunds: next(current.refunds) });
  }, []);

  const commitPayouts = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ ...current, payouts: next(current.payouts) });
  }, []);

  return { ...state, commitPayments, commitRefunds, commitPayouts };
}
