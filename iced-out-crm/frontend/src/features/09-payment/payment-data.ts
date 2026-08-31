import { formatPrice } from "@/features/02-products/utils/format-price";

/**
 * Everything the payments area knows, and the whole vocabulary it speaks.
 *
 * Three registers, one idea each:
 *
 *   - a PAYMENT is money a customer owes, and whether it arrived,
 *   - a REFUND is money the store sent back (filed under Returns, which is
 *     where a refund is actually decided),
 *   - a PAYOUT is the gateway moving what is left into the bank.
 *
 * That is the entire model. There is no fourth kind of record and no state
 * that means "somebody go and look at this": a payment the gateway disagrees
 * with simply did not land, which is why the mismatches screen and the
 * reconciliation screen are both gone.
 *
 * Amounts are whole rupees kept as strings, because every record in this
 * console is a flat string map. `money()` is the only thing that formats one,
 * so no screen can print a differently punctuated total than its neighbour.
 */

/** The one way a rupee figure is ever written on these screens. */
export function money(amount: string) {
  return formatPrice(Number(amount) || 0);
}

/** Adds up one amount column. Every total in this area is one of these. */
export function total(rows: Array<Record<string, string>>, key: string) {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

/** Counts read better with a leading zero next to the money figures. */
export function pad(count: number) {
  return String(count).padStart(2, "0");
}

/**
 * When something happened, in the format the ledger prints — `04 Aug, 14:32`.
 *
 * Only ever called from an event handler, never from a render. This app is
 * statically exported, so a clock read while rendering disagrees with the HTML
 * the build wrote and the page hydrates with the timestamps flickering.
 */
export function stampNow() {
  return new Date()
    .toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(" at ", ", ");
}

/**
 * A shopper's name, down to what the back office actually needs to recognise
 * them: `Aarav Kumar` becomes `A•••• K••••`.
 *
 * The console never needs the whole name to do the job, so it never holds one
 * — which is why the seeded rows are masked too. Masking happens on the way IN,
 * so the full name is never written to storage in the first place.
 */
export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "Guest";
  return parts.map((part) => `${part[0].toUpperCase()}••••`).join(" ");
}

/* ==================================================== the four vocabularies */

/**
 * The four things that can be true of money a customer owes.
 *
 *   Captured — it arrived. Every online payment lands here or in `Failed`:
 *              a card or a gateway either takes the money or it does not.
 *   Due      — cash on delivery. A real order, correctly placed, that the
 *              courier collects at the door. It becomes `Captured` when
 *              someone says the cash came back.
 *   Failed   — the attempt bounced. Nothing was taken from the customer.
 *   Refunded — it arrived and was sent back.
 *
 * `Due` is the only one waiting on the world rather than on the gateway, and
 * it is the reason there is no "Review": a payment is never a question for an
 * operator to adjudicate, it is a fact about whether the money is in.
 */
export const PAYMENT_STATES = ["Captured", "Due", "Failed", "Refunded"];

/** A refund is asked for, sent to the gateway, done, or bounced back. */
export const REFUND_STATES = ["Requested", "Processing", "Succeeded", "Failed"];

/** A payout has either reached the bank or is still on its way. */
export const PAYOUT_STATES = ["Paid", "Pending"];

/**
 * Who takes the money.
 *
 * `Courier` is cash on delivery — the money is collected at the door, so the
 * courier IS the gateway. `On device` is this build's simulated card
 * authorisation: there is no acquirer behind it, and a row that says so is
 * better than one wearing a gateway's name it never reached.
 */
export const GATEWAYS = ["Razorpay", "Stripe", "Cashfree", "On device", "Courier"];

export const REFUND_REASONS = [
  "Return approved",
  "Order cancelled",
  "Payment mismatch",
  "Goodwill",
];

/* ================================================================== records */

/**
 * Money in. `note` is what the gateway said about it — for a captured payment
 * that is a formality, and for one in review it is the whole reason it is
 * sitting there. `reference` is the gateway's own id, which is what support is
 * asked about; the row's `id` is this console's, and is only ever a route.
 *
 * Customer names are masked in the fixtures as they are everywhere else: this
 * console never needs the full name to do the job, so it never holds one.
 */
export const payments = [
  { id: "pay_ICE1048", order: "IO-2026-1048", customer: "A•••• K••••", gateway: "Razorpay", method: "UPI ••••42", amount: "11400", status: "Captured", note: "Taken at checkout", reference: "rzp_live_8Kq2•••4810", created: "04 Aug, 14:32" },
  { id: "pay_ICE1047", order: "IO-2026-1047", customer: "R•••• S••••", gateway: "Courier", method: "Cash on delivery", amount: "8900", status: "Due", note: "The courier collects it at the door", reference: "", created: "04 Aug, 14:18" },
  { id: "pay_ICE1046", order: "IO-2026-1046", customer: "M•••• P••••", gateway: "Razorpay", method: "Netbanking", amount: "18700", status: "Failed", note: "Bank declined the debit", reference: "rzp_live_7Jd9•••4602", created: "04 Aug, 13:51" },
  { id: "pay_ICE1045", order: "IO-2026-1045", customer: "S•••• N••••", gateway: "Razorpay", method: "UPI ••••11", amount: "6200", status: "Captured", note: "Taken at checkout", reference: "rzp_live_5Tb1•••4553", created: "04 Aug, 13:20" },
  { id: "pay_ICE1044", order: "IO-2026-1044", customer: "K•••• V••••", gateway: "Cashfree", method: "Mastercard ••••7731", amount: "12400", status: "Refunded", note: "Sent back in full after a return", reference: "cf_9021•••4471", created: "03 Aug, 19:04" },
  { id: "pay_ICE1043", order: "IO-2026-1043", customer: "D•••• J••••", gateway: "Courier", method: "Cash on delivery", amount: "24800", status: "Due", note: "Out for delivery — collect on arrival", reference: "", created: "03 Aug, 18:12" },
];

/** Money back out. A refund always names the payment it reverses. */
export const refunds = [
  { id: "ref_ICE072", payment: "pay_ICE1044", order: "IO-2026-1044", amount: "12400", reason: "Return approved", status: "Succeeded" },
  { id: "ref_ICE071", payment: "pay_ICE1034", order: "IO-2026-1034", amount: "4600", reason: "Order cancelled", status: "Processing" },
  { id: "ref_ICE070", payment: "pay_ICE1047", order: "IO-2026-1047", amount: "8900", reason: "Payment mismatch", status: "Requested" },
  { id: "ref_ICE069", payment: "pay_ICE1021", order: "IO-2026-1021", amount: "3100", reason: "Goodwill", status: "Failed" },
];

/** Money in the bank. `net` is always `gross - fees` — the register derives it. */
export const payouts = [
  { id: "out_ICE084", gateway: "Razorpay", period: "03–04 Aug 2026", gross: "284600", fees: "5692", net: "278908", status: "Pending" },
  { id: "out_ICE083", gateway: "Stripe", period: "02–03 Aug 2026", gross: "94200", fees: "2166", net: "92034", status: "Paid" },
  { id: "out_ICE082", gateway: "Razorpay", period: "01–02 Aug 2026", gross: "196300", fees: "3926", net: "192374", status: "Paid" },
];

/**
 * Money that was asked for and did not arrive. The dashboard counts these as
 * its payment exceptions — a payment still `Due` is not one of them, because
 * cash on delivery not yet collected is the plan working, not a problem.
 */
export const paymentExceptions = payments.filter((payment) => payment.status === "Failed");
