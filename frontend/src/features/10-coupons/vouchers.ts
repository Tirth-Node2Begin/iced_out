import { formatPrice } from "@/features/02-products/utils/format-price";
import type { Coupon } from "@/features/10-coupons/coupons";

/**
 * Store credit, as a thing a shopper can hold and redeem.
 *
 * A settled return does not send money back to a card — it issues a voucher
 * for the value, and that voucher is redeemed at checkout like any other code.
 * Modelling it as a `Coupon` with `kind: "amount"` is the whole trick: the
 * bag, the drawer, the cart page and the checkout summary already know how to
 * quote an amount coupon, so a voucher discounts correctly everywhere without
 * a second discount path existing to disagree with the first.
 *
 * A voucher is used ONCE. It is `Active` until an order is placed against it
 * and `Claimed` from that moment, and a claimed voucher is not offered to the
 * bag at all — so it cannot be applied a second time by typing the code again,
 * by restoring it from storage, or by opening a second tab. Copying the code
 * does not claim it: only placing an order does.
 */

export type Voucher = {
  /** "IOV072" — short enough to read off a screen and type into a field. */
  code: string;
  /** What it is worth, in whole rupees. */
  amount: number;
  /**
   * The return that paid for it. One return issues at most one voucher.
   * Empty on a voucher the store issued by hand.
   */
  returnId: string;
  /** What it is for, in the words the customer would recognise. */
  reason: string;
  customer: string;
  /** ISO `YYYY-MM-DD`, all three — see `formatDay`. */
  issuedOn: string;
  expiresOn: string;
  /** The day it was redeemed. Empty while it can still be spent. */
  claimedOn: string;
  /** The order that claimed it, so a customer can see where it went. */
  claimedOrder: string;
};

export const VOUCHERS_KEY = "iced-out.vouchers";

/** Claimed vouchers stay in the list — a voucher is a record, not a session. */
export function isClaimed(voucher: Voucher) {
  return voucher.claimedOn !== "";
}

export function voucherState(voucher: Voucher) {
  return isClaimed(voucher) ? "Claimed" : "Active";
}

/** Where a voucher came from: the return that paid for it, or a person. */
export function voucherSource(voucher: Voucher) {
  return voucher.returnId ? `Return ${voucher.returnId}` : "Issued by the store";
}

/**
 * What a voucher is for, as a heading and a quieter second line.
 *
 * A return voucher names the garment that came back and cites the return
 * under it. One issued by hand names whatever the operator typed and cites
 * the store. When there is nothing typed — or when what was typed IS where it
 * came from — the second line is dropped rather than printing the same
 * sentence twice, which is what the cell used to do.
 */
export function voucherPurpose(voucher: Voucher) {
  const reason = voucher.reason.trim();
  const source = voucherSource(voucher);
  const same = reason.toLowerCase() === source.toLowerCase();

  return {
    title: reason || source,
    note: reason && !same ? source : "",
  };
}

/* ================================================================= dates */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Dates are stored ISO and formatted for reading.
 *
 * ISO is what a `<input type="date">` speaks, so an operator setting an expiry
 * and the ledger showing it are handling the same string. The formatting is
 * done by splitting rather than by `Date`, because parsing a date-only string
 * lands on UTC midnight — which renders as the day before in any timezone
 * behind UTC, and would disagree between the build and the browser.
 */
export function formatDay(iso: string) {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

const MONTH_INDEX = new Map(MONTHS.map((name, index) => [name.toLowerCase(), index + 1]));

/**
 * A stored date, dragged onto ISO if it is not there already.
 *
 * This store used to keep dates in the display format — "22 Jul 2026" — so a
 * browser that held vouchers before the switch still has records written that
 * way. They read back fine (`formatDay` hands an unrecognised string straight
 * on) but a `<input type="date">` cannot show one, which would open the edit
 * form with the dates blank. Converting on the way in fixes both, once.
 */
export function normaliseDay(value: string) {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(value.trim());
  const month = match && MONTH_INDEX.get(match[2].slice(0, 3).toLowerCase());
  /* Anything else is left exactly as it was: unreadable to a date input, but
     still the thing the customer was told, which beats blanking it. */
  if (!match || !month) return value;

  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** `YYYY-MM-DD` for a date. Local, not UTC, so "today" means the operator's. */
export function toISODay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/* Reads the clock, so never during a render — this app is statically exported
   and a date baked at build time is wrong by the next morning. Event handlers
   and post-hydration effects only. */
export function todayISO() {
  return toISODay(new Date());
}

/** The default validity on a new voucher: one year. */
export function defaultExpiryISO() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return toISODay(date);
}

/* ============================================================== the code */

/**
 * The code a return's voucher gets.
 *
 * Minted from the return's own number rather than from a clock or a random
 * source: `ret-072` becomes `IOV072`, which is traceable in both directions and
 * — unlike anything random — identical on the server render and the client
 * one. It steps over a code already taken, so a second voucher against the
 * same digits cannot collide with the first.
 */
export function voucherCodeFor(returnId: string, existing: Voucher[]) {
  const digits = returnId.replace(/\D/g, "").padStart(3, "0");
  const base = `IOV${digits}`;

  let code = base;
  let suffix = 1;
  while (existing.some((voucher) => voucher.code === code)) {
    suffix += 1;
    code = `${base}-${suffix}`;
  }
  return code;
}

/* ============================================================ redemption */

/**
 * A voucher as the bag sees it.
 *
 * `minSubtotal` is zero because store credit the shop already owes cannot be
 * made conditional on spending more.
 */
export function voucherToCoupon(voucher: Voucher): Coupon {
  return {
    code: voucher.code,
    label: `Return voucher · ${formatPrice(voucher.amount)}`,
    kind: "amount",
    value: voucher.amount,
    minSubtotal: 0,
  };
}

/**
 * Every voucher the bag will accept — which is every one NOT yet claimed.
 *
 * This is the single wall that makes a voucher one-use. A claimed code is not
 * in the table, so `redeemCoupon` refuses it, a code restored from storage
 * stops resolving, and the discount it was giving goes to zero. There is no
 * second check anywhere that could disagree with this one.
 */
export function redeemableCoupons(vouchers: Voucher[]): Coupon[] {
  return vouchers.filter((voucher) => !isClaimed(voucher)).map(voucherToCoupon);
}

/** What is still out there unclaimed, in rupees. */
export function voucherBalance(vouchers: Voucher[]) {
  return vouchers.reduce(
    (sum, voucher) => (isClaimed(voucher) ? sum : sum + Math.max(0, voucher.amount)),
    0,
  );
}

/* ============================================================== storage */

/**
 * One record per voucher, read back defensively.
 *
 * Hand-edited or half-written storage starts clean rather than throwing on
 * boot — the same rule the bag applies to itself. A record written before
 * vouchers became one-use carried `issued` and `remaining` instead of an
 * amount and a claim; it is read forward rather than discarded, because
 * throwing it away would take a customer's credit with it.
 *
 * A reviver over already-parsed JSON rather than a reader of its own, so the
 * store in front of it owns the one thing that has to be got right: caching the
 * parse against the raw string. Parsing on every read hands React a new array
 * each time, which it reads as "changed" and re-renders forever.
 */
export function reviveVouchers(parsed: unknown): Voucher[] {
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): Voucher[] => {
    const value = entry as Partial<Voucher> & { issued?: unknown; remaining?: unknown };
    if (typeof value.code !== "string") return [];

    const amount = Number(value.amount ?? value.issued);
    if (!Number.isFinite(amount)) return [];

    const issuedOn = normaliseDay(typeof value.issuedOn === "string" ? value.issuedOn : "");
    /* An old record with nothing left on it was a spent one, so it comes
       back claimed rather than as free money. */
    const drained = value.amount === undefined && Number(value.remaining) === 0;

    return [
      {
        code: value.code,
        amount: Math.max(0, Math.round(amount)),
        returnId: typeof value.returnId === "string" ? value.returnId : "",
        reason: typeof value.reason === "string" ? value.reason : "Return",
        customer: typeof value.customer === "string" ? value.customer : "",
        issuedOn,
        expiresOn: normaliseDay(typeof value.expiresOn === "string" ? value.expiresOn : ""),
        claimedOn: normaliseDay(
          typeof value.claimedOn === "string" ? value.claimedOn : drained ? issuedOn : "",
        ),
        claimedOrder: typeof value.claimedOrder === "string" ? value.claimedOrder : "",
      },
    ];
  });
}

/**
 * The one voucher this browser starts with: the credit for `ret-061`, the
 * return the account's own archive already shows as settled. Without it a new
 * visitor's vouchers tab is empty for a return their orders page says closed
 * weeks ago, and the two screens would be telling different stories.
 */
export const seededVouchers: Voucher[] = [
  {
    code: "IOV061",
    amount: 4600,
    returnId: "ret-061",
    reason: "Core Heavy Tee · Ink / S",
    customer: "You",
    issuedOn: "2026-07-22",
    expiresOn: "2027-07-22",
    claimedOn: "",
    claimedOrder: "",
  },
];
