import type { RecordRow } from "@/components/admin/record-manager";

/**
 * The customer register's seed, shared by the list and the detail screen.
 *
 * Both screens read the same rows so the numbers agree: a customer listed with
 * three orders opens onto exactly three orders, and their lifetime value is the
 * sum of them rather than a second figure that happens to sit nearby.
 */

/** The only two things a customer account can be. */
export const CUSTOMER_STATES = ["Active", "Blocked"];

export const CUSTOMER_SEED: RecordRow[] = [
  {
    id: "cus-2048",
    name: "Aarav Kapoor",
    email: "aarav.kapoor@example.com",
    phone: "+91 98765 43210",
    orders: "4",
    value: "₹42,600",
    state: "Active",
    seen: "11 Aug, 18:40",
  },
  {
    id: "cus-2047",
    name: "Riya Sharma",
    email: "riya.sharma@example.com",
    phone: "+91 98110 22417",
    orders: "2",
    value: "₹17,800",
    state: "Active",
    seen: "09 Aug, 11:02",
  },
  {
    id: "cus-2031",
    name: "Meera Patel",
    email: "meera.patel@example.com",
    phone: "+91 99200 51188",
    orders: "7",
    value: "₹81,400",
    state: "Active",
    seen: "12 Aug, 09:26",
  },
  {
    id: "cus-2019",
    name: "Dev Walia",
    email: "dev.walia@example.com",
    phone: "+91 97400 66302",
    orders: "1",
    value: "₹6,400",
    state: "Active",
    seen: "28 Jul, 20:15",
  },
  {
    id: "cus-1984",
    name: "Sana Rahman",
    email: "sana.rahman@example.com",
    phone: "+91 98450 71923",
    orders: "3",
    value: "₹28,900",
    state: "Blocked",
    seen: "02 Aug, 16:48",
  },
];

/** Each customer's order history. Every list sums to their lifetime value. */
export const CUSTOMER_ORDERS: Record<string, RecordRow[]> = {
  "cus-2048": [
    { id: "IO-2026-1048", placed: "04 Aug", pieces: "2", value: "₹17,800", status: "In fulfilment" },
    { id: "IO-2026-1021", placed: "22 Jul", pieces: "1", value: "₹8,900", status: "Delivered" },
    { id: "IO-2026-0984", placed: "09 Jul", pieces: "3", value: "₹12,400", status: "Delivered" },
    { id: "IO-2026-0912", placed: "18 Jun", pieces: "1", value: "₹3,500", status: "Delivered" },
  ],
  "cus-2047": [
    { id: "IO-2026-1039", placed: "01 Aug", pieces: "1", value: "₹11,900", status: "Delivered" },
    { id: "IO-2026-0968", placed: "05 Jul", pieces: "1", value: "₹5,900", status: "Delivered" },
  ],
  "cus-2031": [
    { id: "IO-2026-1044", placed: "03 Aug", pieces: "2", value: "₹24,900", status: "In fulfilment" },
    { id: "IO-2026-1012", placed: "19 Jul", pieces: "2", value: "₹18,400", status: "Delivered" },
    { id: "IO-2026-0977", placed: "07 Jul", pieces: "1", value: "₹12,600", status: "Delivered" },
    { id: "IO-2026-0941", placed: "26 Jun", pieces: "1", value: "₹9,800", status: "Delivered" },
    { id: "IO-2026-0908", placed: "16 Jun", pieces: "1", value: "₹7,400", status: "Delivered" },
    { id: "IO-2026-0872", placed: "02 Jun", pieces: "1", value: "₹5,300", status: "Delivered" },
    { id: "IO-2026-0831", placed: "21 May", pieces: "1", value: "₹3,000", status: "Delivered" },
  ],
  "cus-2019": [
    { id: "IO-2026-1030", placed: "28 Jul", pieces: "1", value: "₹6,400", status: "Delivered" },
  ],
  "cus-1984": [
    { id: "IO-2026-0996", placed: "12 Jul", pieces: "1", value: "₹14,200", status: "Delivered" },
    { id: "IO-2026-0934", placed: "24 Jun", pieces: "1", value: "₹9,700", status: "Delivered" },
    { id: "IO-2026-0865", placed: "31 May", pieces: "1", value: "₹5,000", status: "Cancelled" },
  ],
};

/**
 * When something last happened on an account, in the console's own format —
 * "13 Aug, 14:34". Written whenever a shopper signs in on the storefront, so
 * the register shows who has been around rather than only who exists.
 */
export function stampNow() {
  const now = new Date();
  const day = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

/** "aarav.kapoor@example.com" → "Aarav Kapoor", for a sign-in with no name. */
export function nameFromEmail(email: string) {
  const words = email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || email;
}

export function customerOrders(id: string) {
  return CUSTOMER_ORDERS[id] ?? [];
}

/** "₹42,600" back to 42600, so a column of money can be added up. */
export function moneyValue(value: string | undefined) {
  return Number((value ?? "").replace(/[^\d]/g, "")) || 0;
}

export function rupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * The ids a customer recorded in the browser is allowed to take.
 *
 * `next build` writes this site out as static HTML, so
 * `/admin/customers/<id>` only exists for the ids `generateStaticParams` knew
 * at build time — an id invented when a shopper signs up would 404 on the
 * exported site. New customers therefore take the next free id out of this
 * band, all of which ARE exported. It carries on from the seed rather than
 * being marked "local", because unlike an order id this one is printed in the
 * register under the customer's name, and it should read like every other.
 *
 * The same arrangement the orders module uses for a checkout — see
 * `features/07-orders/data/order-slots.ts`.
 */
export const CUSTOMER_SLOT_COUNT = 30;

export const reservedCustomerSlots = Array.from(
  { length: CUSTOMER_SLOT_COUNT },
  (_, index) => `cus-${2050 + index}`,
);

/**
 * The next id, minted rather than typed.
 *
 * An operator adding a customer answers for the person — their name, their
 * contact — and never for the record's key, which is ours to keep unique.
 *
 * Past the reserved band the sequence simply carries on. Such a record is a
 * full member of the register — searched, edited, exported — its own page is
 * just not in the static export, which takes 30 new customers on one device
 * to reach.
 */
export function nextCustomerId(rows: RecordRow[]) {
  const taken = new Set(rows.map((row) => row.id));
  const free = reservedCustomerSlots.find((slot) => !taken.has(slot));
  if (free) return free;

  const highest = rows.reduce(
    (top, row) => Math.max(top, Number((row.id ?? "").replace(/\D/g, "")) || 0),
    2000,
  );
  return `cus-${highest + 1}`;
}
