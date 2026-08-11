/**
 * Card entry — brand, formatting and the checks a card form owes the shopper.
 *
 * This module exists so the checkout can REFUSE a card before it ever tries to
 * charge one. Everything here runs in the browser and none of it is a security
 * control: a Luhn check catches a mistyped digit, it does not tell you a card
 * is real, has funds, or belongs to whoever is typing. Only a gateway knows
 * that, which is exactly why the numbers below never leave this module's
 * caller — nothing here is written to storage, put in the checkout draft, or
 * copied onto an order. What survives a card payment is the brand and the last
 * four digits, and that is all a receipt has ever needed.
 *
 * A real deployment should not be keying cards on-origin at all; it should send
 * the shopper to the gateway (see `razorpay.ts`) so the PAN never touches this
 * code. The card option is kept because it was asked for, and it is kept honest
 * by never pretending the browser authorised anything.
 */

export type CardBrand = "Visa" | "Mastercard" | "Amex" | "RuPay" | "Discover" | "Card";

/** Everything the card panel collects. Never persisted — see the note above. */
export type CardDraft = {
  number: string;
  name: string;
  /** `MM/YY`, kept as typed so the field can be corrected mid-entry */
  expiry: string;
  cvv: string;
};

export const emptyCard: CardDraft = { number: "", name: "", expiry: "", cvv: "" };

/** Digits only — every check below counts digits, never the spaces between. */
export function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Brand from the opening digits.
 *
 * Prefix ranges, not lengths: the brand is wanted while the number is still
 * being typed (it drives the grouping and the CVV length), so it has to be
 * decidable from the first two digits and stay decided as more arrive.
 */
export function cardBrand(number: string): CardBrand {
  const digits = digitsOf(number);
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(0|5|08|52)/.test(digits)) return "RuPay";
  if (/^6(011|4[4-9]|5)/.test(digits)) return "Discover";
  return "Card";
}

/** Amex is 15 digits in 4-6-5; everything else this app takes is 16 in fours. */
export function cardGroups(brand: CardBrand) {
  return brand === "Amex" ? [4, 6, 5] : [4, 4, 4, 4];
}

export function cvvLength(brand: CardBrand) {
  return brand === "Amex" ? 4 : 3;
}

/** `4111111111111111` → `4111 1111 1111 1111`, capped at the brand's length. */
export function formatCardNumber(value: string) {
  const brand = cardBrand(value);
  const groups = cardGroups(brand);
  const digits = digitsOf(value).slice(0, groups.reduce((sum, size) => sum + size, 0));

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  return parts.join(" ");
}

/**
 * `1226` → `12/26`, and a lone `3` → `03/`.
 *
 * The single-digit expansion is the difference between a field that reads what
 * someone meant and one that silently accepts `3/1` as March 2001.
 */
export function formatExpiry(value: string) {
  const digits = digitsOf(value).slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length === 1) return /[2-9]/.test(digits) ? `0${digits}/` : digits;
  const month = digits.slice(0, 2);
  const year = digits.slice(2);
  return year.length > 0 ? `${month}/${year}` : month;
}

/** The Luhn checksum every issuer's numbering satisfies. */
export function passesLuhn(number: string) {
  const digits = digitsOf(number);
  if (digits.length < 12) return false;

  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * `MM/YY` against the month it is now.
 *
 * A card is good through the LAST day of its printed month, so the comparison
 * is month-to-month — treating an expiry of this month as already dead rejects
 * a card that still works for another three weeks.
 *
 * `now` is a parameter with a default rather than a module constant because
 * this app is exported as static HTML: a date captured at module scope is the
 * date of the BUILD, and by the time the page is opened it can be months stale.
 * Callers only reach this from an event handler, so the default is evaluated at
 * the moment the shopper presses the button.
 */
export function expiryProblem(value: string, now = new Date()): string | null {
  const digits = digitsOf(value);
  if (digits.length !== 4) return "Enter the expiry as MM/YY.";

  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return "That month does not exist.";

  const expired =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth() + 1);
  if (expired) return "That card has expired.";

  // Cards are not issued more than ~10 years out; anything beyond that is a
  // typo in the year, which is worth catching before the gateway does.
  if (year > now.getFullYear() + 20) return "Check the expiry year.";
  return null;
}

/** `Visa ending 1111` — the only form of a card number an order ever stores. */
export function cardLabel(card: CardDraft) {
  return `${cardBrand(card.number)} ending ${digitsOf(card.number).slice(-4)}`;
}
