import { productFixtures } from "@/features/02-products/api/product-fixtures";
import type { ProductVariant } from "@/features/02-products/types/product";

/**
 * The order register's rows, and the goods behind them.
 *
 * Kept in a plain module rather than beside the workspace component: a value
 * exported from a `"use client"` file arrives on the server as a client
 * reference rather than as the array itself, and both the dashboard and the
 * detail route's `generateStaticParams` need to read these.
 *
 * An order is seeded as its LINES — real products from the catalogue, with a
 * quantity — and its item count and value are counted from them. Nothing is
 * typed twice, so a row can never claim three items while its record lists
 * two, and a product renamed in the catalogue is renamed on every order that
 * bought it.
 */

/**
 * An order has three states and no more. It is `Placed` when it arrives,
 * `Confirmed` once a person agrees it is real, and `Cancelled` if it is called
 * off — by the store or by the customer, which are the same fact about the
 * order and differ only in who is recorded as having asked.
 *
 * Everything after confirmation is the shipment's business, not the order's.
 */
export const ORDER_STATES = ["Placed", "Confirmed", "Cancelled"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const PAYMENT_STATES = ["Captured", "Pending", "Failed", "Refunded"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/** How the money moved. Shown on the record wherever payment is. */
export const PAYMENT_METHODS = ["UPI", "Card", "Netbanking", "Cash on delivery"] as const;

/** Who called the order off. Empty unless the order is cancelled. */
export const CANCELLED_BY = ["Store", "Customer"] as const;

export type AdminOrderFixture = {
  id: string;
  customer: string;
  /** Total pieces across the lines — the register formats it. */
  items: string;
  /** Rupees, unformatted, so the form can edit it as a number. */
  value: string;
  payment: PaymentState;
  method: string;
  status: OrderState;
  /** Where it is going — what the parcel inherits when it is dispatched. */
  destination: string;
  /** How long it has waited, as an operator reads it. */
  age: string;
  cancelledBy?: string;
};

/** One thing in the bag: what it is, which size, how many, at what price. */
export type OrderLine = {
  productId: string;
  name: string;
  size: ProductVariant["size"];
  qty: number;
  /** The catalogue price of ONE, at the time of the order. */
  price: number;
};

type Seed = {
  id: string;
  customer: string;
  payment: PaymentState;
  method: string;
  status: OrderState;
  destination: string;
  age: string;
  placed: string;
  cancelledBy?: string;
  lines: Array<{ product: string; size: ProductVariant["size"]; qty: number }>;
};

const SEEDS: Seed[] = [
  {
    id: "IO-2026-1048",
    customer: "Aarav K.",
    payment: "Captured",
    method: "UPI",
    status: "Placed",
    destination: "Bengaluru",
    age: "08 min",
    placed: "04 Aug · 14:32",
    lines: [
      { product: "afterdark-hoodie", size: "M", qty: 1 },
      { product: "core-heavy-tee", size: "L", qty: 2 },
    ],
  },
  {
    id: "IO-2026-1047",
    customer: "Riya S.",
    payment: "Pending",
    method: "Card",
    status: "Placed",
    destination: "Mumbai",
    age: "16 min",
    placed: "04 Aug · 14:24",
    lines: [{ product: "bone-utility-overshirt", size: "S", qty: 1 }],
  },
  {
    id: "IO-2026-1046",
    customer: "Maya P.",
    payment: "Captured",
    method: "UPI",
    status: "Confirmed",
    destination: "Delhi",
    age: "42 min",
    placed: "04 Aug · 13:58",
    lines: [
      { product: "shadow-cargo-02", size: "M", qty: 1 },
      { product: "afterdark-hoodie", size: "L", qty: 1 },
      { product: "core-heavy-tee", size: "M", qty: 1 },
    ],
  },
  {
    id: "IO-2026-1045",
    customer: "Ishan T.",
    payment: "Captured",
    method: "Card",
    status: "Confirmed",
    destination: "Bengaluru",
    age: "1 h 04 min",
    placed: "04 Aug · 13:36",
    lines: [{ product: "afterdark-hoodie", size: "L", qty: 2 }],
  },
  {
    id: "IO-2026-1044",
    customer: "Dev W.",
    payment: "Captured",
    method: "Cash on delivery",
    status: "Confirmed",
    destination: "Pune",
    age: "1 h 12 min",
    placed: "04 Aug · 13:28",
    lines: [{ product: "core-heavy-tee", size: "S", qty: 1 }],
  },
  {
    id: "IO-2026-1042",
    customer: "Sana R.",
    payment: "Refunded",
    method: "UPI",
    status: "Cancelled",
    destination: "Chennai",
    age: "2 h 04 min",
    placed: "04 Aug · 12:36",
    cancelledBy: "Customer",
    lines: [
      { product: "shadow-cargo-02", size: "L", qty: 1 },
      { product: "core-heavy-tee", size: "XL", qty: 1 },
    ],
  },
  {
    id: "IO-2026-1039",
    customer: "Noor A.",
    payment: "Captured",
    method: "UPI",
    status: "Confirmed",
    destination: "Kolkata",
    age: "5 h 20 min",
    placed: "04 Aug · 09:20",
    lines: [{ product: "afterdark-hoodie", size: "XL", qty: 1 }],
  },
];

/** A seeded line, resolved against the catalogue it was bought from. */
function resolve(line: Seed["lines"][number]): OrderLine {
  const product = productFixtures.find((entry) => entry.id === line.product);
  return {
    productId: line.product,
    name: product?.name ?? line.product,
    size: line.size,
    qty: line.qty,
    price: product?.price ?? 0,
  };
}

const LINES = new Map<string, OrderLine[]>(SEEDS.map((seed) => [seed.id, seed.lines.map(resolve)]));

/** What one line came to: quantity times the price of one. */
export function lineTotal(line: OrderLine) {
  return line.qty * line.price;
}

export const adminOrderFixtures: AdminOrderFixture[] = SEEDS.map((seed) => {
  const lines = LINES.get(seed.id) ?? [];
  return {
    id: seed.id,
    customer: seed.customer,
    items: String(lines.reduce((count, line) => count + line.qty, 0)),
    value: String(lines.reduce((total, line) => total + lineTotal(line), 0)),
    payment: seed.payment,
    method: seed.method,
    status: seed.status,
    destination: seed.destination,
    age: seed.age,
    ...(seed.cancelledBy ? { cancelledBy: seed.cancelledBy } : {}),
  };
});

/** Every id the register knows, for the detail route's static params. */
export const adminOrderIds = SEEDS.map((seed) => seed.id);

/** What the order bought. Empty for an order minted in the browser. */
export function orderLines(orderId: string): OrderLine[] {
  return LINES.get(orderId) ?? [];
}

/** When the order was placed, for the head of its timeline. */
export function orderPlacedAt(orderId: string): string | undefined {
  return SEEDS.find((seed) => seed.id === orderId)?.placed;
}

/**
 * Minutes behind an age string, so "the oldest one" is a comparison rather
 * than a guess. Records in this console are flat string maps by design, so the
 * number is parsed here instead of being carried as a second field that every
 * form and CSV export would then have to know about.
 */
export function ageMinutes(age: string): number {
  const hours = /(\d+)\s*h/.exec(age);
  const minutes = /(\d+)\s*min/.exec(age);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}
