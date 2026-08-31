/**
 * The wallet: store credit as a BALANCE, not as a code.
 *
 * A returned piece used to become a voucher, and a voucher was spent through
 * the coupon field — which lost money two ways and nobody noticed, because both
 * failures look like nothing happening:
 *
 *   · a voucher was consumed WHOLE. ₹4,600 of credit spent on a ₹1,200 order
 *     destroyed ₹3,400 of the shopper's money, with no line anywhere saying so.
 *   · it occupied the one coupon slot an order has, so using your own money
 *     meant giving up any promotion that was running.
 *
 * A balance has neither problem. It is spent to the rupee, over as many orders
 * as it takes, beside a coupon rather than instead of one — and when an order
 * costs more than the balance, the rest goes to the gateway as usual.
 *
 * Everything here is a READ of what the server says. The browser never computes
 * a balance: `POST /checkout/orders` re-reads it under a row lock and is allowed
 * to refuse, so anything this file quotes is a display of the last answer, not
 * a promise about the next one.
 */

/** Why money moved. Mirrors `WalletService`'s constants and the DB's CHECK. */
export type WalletKind =
  | "return"
  | "exchange"
  | "voucher"
  | "order"
  | "reversal"
  | "adjustment";

export type WalletEntry = {
  /** `wtx-000123` — stable, and quotable to support. */
  id: string;
  direction: "credit" | "debit";
  /** "+" or "−", from the server, so no screen builds the sign itself. */
  sign: string;
  /** Always positive, whole rupees. `direction` carries which way it went. */
  amount: number;
  /** What the balance stood at after this movement — the statement's spine. */
  balanceAfter: number;
  kind: WalletKind;
  /** ret-072, IO-2026-1049, IOV072 — the thing on the other side of it. */
  reference: string;
  /** "Return ret-072", already assembled by the presenter. */
  title: string;
  note: string;
  /** `YYYY-MM-DD HH:MM:SS.uuuuuu` from MySQL — see `formatStamp`. */
  at: string;
};

/** A voucher on the account that has not been poured in yet. */
export type PendingVoucher = {
  code: string;
  amount: number;
  reason: string;
  expiresOn: string;
};

export type Wallet = {
  /** Whole rupees, spendable right now. */
  balance: number;
  currency: string;
  entries: WalletEntry[];
  /** Over the whole statement, not the page of it that was fetched. */
  totals: { earned: number; spent: number };
  pending: PendingVoucher[];
};

/**
 * What a signed-out visitor has, and what every screen renders before the first
 * response lands. A wallet is money owed to an ACCOUNT: there is no such thing
 * as a browser's wallet, so the empty one is the honest starting point.
 */
export const EMPTY_WALLET: Wallet = {
  balance: 0,
  currency: "INR",
  entries: [],
  totals: { earned: 0, spent: 0 },
  pending: [],
};

/**
 * How much of a bill this balance can pay.
 *
 * The lesser of the two, floored at zero, because credit cannot pay more than
 * the order costs — there is no change given — and a negative bill is not a
 * refund. This is the same clamp `PlaceOrderService::spendWallet` applies
 * server-side; having it in both places is deliberate, and the server's is the
 * one that decides.
 */
export function applicableCredit(balance: number, payable: number) {
  return Math.max(0, Math.min(Math.round(balance), Math.round(Math.max(0, payable))));
}

/**
 * A MySQL `DATETIME(6)` as a line in a statement.
 *
 * Split rather than parsed: `new Date("2026-08-24 11:38:02")` is not a format
 * every engine agrees on, and the ones that do accept it read it as UTC — which
 * renders an evening's credit as the following morning for anyone ahead of it.
 * The server already writes these in the store's own timezone, so the string is
 * the answer and reformatting it is all that is wanted.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatStamp(at: string) {
  const [date, time = ""] = at.split(" ");
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return at;

  const clock = time.slice(0, 5);
  const stamp = `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;

  return clock ? `${stamp} · ${clock}` : stamp;
}

/** Just the day, for a line that has no room for the clock. */
export function formatDayOnly(at: string) {
  return formatStamp(at).split(" · ")[0];
}

/**
 * The ledger, cut into the months it happened in.
 *
 * A statement is read by when things happened, and a flat list of forty rows
 * makes the reader do that grouping in their head. The order of the entries is
 * preserved exactly — the server sends newest first — so this only inserts the
 * breaks, it never sorts.
 */
export function byMonth(entries: WalletEntry[]) {
  const groups: Array<{ key: string; label: string; entries: WalletEntry[] }> = [];

  for (const entry of entries) {
    const [date] = entry.at.split(" ");
    const [year, month] = date.split("-");
    const key = `${year}-${month}`;
    const label = `${MONTHS[Number(month) - 1] ?? month} ${year}`;

    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, label, entries: [entry] });
  }

  return groups;
}

/**
 * A code, normalised the way the server compares them.
 *
 * Trimmed and upper-cased here so `iov072 ` and `IOV072` are the same request
 * rather than one working and one coming back "not a code we know" — which is
 * the kind of refusal a shopper reads as the credit being gone.
 */
export function normaliseCode(input: string) {
  return input.trim().toUpperCase();
}
