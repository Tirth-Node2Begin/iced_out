import { productFixtures } from "@/features/02-products/api/product-fixtures";
import { formatPrice } from "@/features/02-products/utils/format-price";

/**
 * The arithmetic behind an exchange, in one place.
 *
 * An exchange is two prices: what came back, and what goes out instead. The
 * gap between them is money that has to move, and which way it moves is the
 * only thing anyone — operator or customer — actually needs told:
 *
 *   replacement costs more  → the difference is collected before it ships
 *   replacement costs less  → the difference goes back as store credit
 *   the same                → nothing is charged and nothing is credited
 *
 * Both the console and the customer's own screens read this file, so the
 * number an operator approves is the number the customer was quoted. The
 * sentences come in two voices for the same reason: same rule, same figure,
 * addressed to whoever is reading it.
 */

/**
 * What a customer can swap into: every size of every product that is actually
 * on the shelf, priced from the catalogue rather than typed again here. A
 * sold-out variant is left out, so nobody can be promised a replacement that
 * does not exist.
 */
export const EXCHANGE_OPTIONS = productFixtures.flatMap((product) =>
  product.variants
    .filter((variant) => variant.stock !== "SOLD_OUT")
    .map((variant) => ({
      /* "Bone Utility Overshirt · L" — the product, then the size it is being
         swapped for. This string is the value stored on a return. */
      value: `${product.name} · ${variant.size}`,
      product: product.name,
      size: variant.size,
      price: product.price,
    })),
);

/**
 * The catalogue price behind a replacement line.
 *
 * Only the product carries a price, so the size is dropped before the lookup —
 * and the price is read live rather than stored on the return, because what a
 * replacement costs is what it costs today.
 */
export function replacementPrice(replacement: string) {
  if (!replacement) return 0;
  const name = (replacement.split("·")[0] ?? "").trim().toLowerCase();
  return productFixtures.find((product) => product.name.toLowerCase() === name)?.price ?? 0;
}

export type ExchangeBalance = {
  /** Signed, in rupees: what the replacement costs, less what came back. */
  difference: number;
  direction: "collect" | "credit" | "even";
  /** The money itself, always positive — `direction` says which way it goes. */
  amount: string;
  /** Short enough for a table cell. */
  short: string;
  /** Names what the difference is, in the fewest words that are true. */
  label: string;
  /** The rule spelled out, for an operator. */
  sentence: string;
  /** The same rule, said to the customer. */
  customerSentence: string;
};

export function exchangeBalance(returned: number, replacement: number): ExchangeBalance {
  const difference = replacement - returned;
  const amount = formatPrice(Math.abs(difference));

  if (difference > 0)
    return {
      difference,
      direction: "collect",
      amount,
      short: `+${amount}`,
      label: "To collect",
      sentence: `The replacement costs ${amount} more, so ${amount} is collected from the customer before it ships.`,
      customerSentence: `The item you want costs ${amount} more, so you pay ${amount} before we send it.`,
    };

  if (difference < 0)
    return {
      difference,
      direction: "credit",
      amount,
      short: `−${amount}`,
      label: "Store credit",
      sentence: `The replacement costs ${amount} less, so ${amount} goes back to the customer as store credit.`,
      customerSentence: `The item you want costs ${amount} less, so ${amount} comes back to you as store credit.`,
    };

  return {
    difference: 0,
    direction: "even",
    amount,
    short: "Even swap",
    label: "Nothing due",
    sentence: "Both items cost the same, so nothing is charged and nothing is credited.",
    customerSentence: "Both items cost the same, so there is nothing more to pay.",
  };
}

/** The balance on a return, read straight off the record. */
export function balanceOf(returnedAmount: string | number, replacement: string) {
  return exchangeBalance(Number(returnedAmount) || 0, replacementPrice(replacement));
}
