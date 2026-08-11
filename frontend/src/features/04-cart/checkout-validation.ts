/**
 * What checkout refuses, and the sentence it refuses with.
 *
 * One module rather than validation scattered through the form, because the
 * wizard asks the same question in three places: may this step be left, may
 * that step be jumped to, and may the order be placed. All three have to get
 * the same answer or the rail ends up letting someone past a step it will not
 * let them submit.
 *
 * Every message is written to be SHOWN. "Invalid input" tells a shopper that
 * something is wrong and nothing about what to do next; "Indian mobile numbers
 * are 10 digits starting 6–9" tells them where to look. The rules are
 * deliberately loose where real data is messy (names, street lines) and strict
 * only where a wrong value has a consequence — an unreachable email, a PIN code
 * that no courier serves, a card that cannot be charged.
 */

import {
  cvvLength,
  cardBrand,
  digitsOf,
  expiryProblem,
  passesLuhn,
  type CardDraft,
} from "@/features/09-payment/card";

import type { CheckoutDraft } from "@/features/04-cart/checkout-context";

export type Errors = Partial<Record<string, string>>;

export type StepId = "contact" | "address" | "payment";

/** The order the steps are asked in, and the only place that order is written. */
export const STEP_ORDER: StepId[] = ["contact", "address", "payment"];

/* Deliberately permissive: it has to accept `x@y.co`, subdomains and a `+tag`,
   and it is not the thing that proves an address is real — the confirmation
   mail is. What it catches is the missing `@` and the trailing comma. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * A typed Indian mobile, reduced to its ten significant digits.
 *
 * The profile stores `+91 98765 43210` and a shopper may type `09876543210`,
 * `+919876543210` or `98765 43210`. All four are the same number, and a form
 * that accepts one and rejects the rest is a form that punishes people for
 * pasting.
 */
export function normalizeMobile(value: string) {
  let digits = digitsOf(value);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function contactErrors(draft: CheckoutDraft): Errors {
  const errors: Errors = {};

  if (draft.name.trim().length < 2) {
    errors.name = "Enter the name the parcel should be addressed to.";
  }

  if (draft.email.trim().length === 0) {
    errors.email = "An email is where the confirmation goes.";
  } else if (!EMAIL.test(draft.email.trim())) {
    errors.email = "That does not look like an email address.";
  }

  const mobile = normalizeMobile(draft.mobile);
  if (mobile.length === 0) {
    errors.mobile = "The courier calls this number before delivering.";
  } else if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
    errors.mobile = "Indian mobile numbers are 10 digits starting 6–9.";
  }

  return errors;
}

function addressErrors(draft: CheckoutDraft): Errors {
  const errors: Errors = {};

  if (draft.address.trim().length < 6) {
    errors.address = "Include the flat or building and the street.";
  }
  if (draft.state.trim().length < 2) errors.state = "Pick the state from the list.";
  if (draft.city.trim().length < 2) errors.city = "Pick the city from the list.";

  const pin = digitsOf(draft.postalCode);
  if (pin.length === 0) {
    errors.postalCode = "A PIN code is needed to check serviceability.";
  } else if (pin.length !== 6 || pin.startsWith("0")) {
    // No Indian PIN code opens with 0 — the leading digit is the postal region.
    errors.postalCode = "Indian PIN codes are 6 digits and do not start with 0.";
  }

  return errors;
}

function deliveryErrors(draft: CheckoutDraft): Errors {
  /* A radio group that starts with a selection cannot be empty, so this exists
     to catch a draft hand-edited in storage rather than anything a shopper can
     do to the form. */
  return draft.deliveryMethod === "standard" || draft.deliveryMethod === "express"
    ? {}
    : { deliveryMethod: "Choose a delivery speed." };
}

/**
 * The last STEP validates two choices, and nothing else.
 *
 * Delivery speed and payment method are asked together — they are the two
 * questions left once the destination is known, and splitting them across two
 * screens made a shopper leave a step to answer a question the previous one had
 * already priced.
 *
 * Neither can take money here. Checkout selects the method; card details are
 * keyed on the payment surface that opens when the shopper presses checkout,
 * and Razorpay takes its own on its own frame — so there is nothing on this
 * page to check beyond "is one of each actually picked".
 */
function paymentErrors(draft: CheckoutDraft): Errors {
  return {
    ...deliveryErrors(draft),
    ...(PAYMENT_IDS.includes(draft.paymentMethod)
      ? {}
      : { paymentMethod: "Choose how this order is paid for." }),
  };
}

const PAYMENT_IDS: string[] = ["cod", "card", "razorpay"];

/**
 * The card itself, checked where it is actually entered.
 *
 * Separate from the step above on purpose: these rules run against fields that
 * never exist on the checkout page, and folding them into the step would leave
 * the checkout button permanently refusing an order over a card number the
 * shopper has not been asked for yet.
 */
export function validateCard(card: CardDraft): Errors {
  const errors: Errors = {};

  const number = digitsOf(card.number);
  const brand = cardBrand(card.number);
  const expected = brand === "Amex" ? 15 : 16;

  if (number.length === 0) {
    errors.cardNumber = "Enter the 16 digits across the front of the card.";
  } else if (number.length !== expected) {
    errors.cardNumber = `A ${brand === "Card" ? "card" : brand} number is ${expected} digits.`;
  } else if (!passesLuhn(number)) {
    errors.cardNumber = "That card number has a digit wrong — check it against the card.";
  }

  if (card.name.trim().length < 2) {
    errors.cardName = "Enter the name printed on the card.";
  } else if (!/^[\p{L}\p{M}.'\- ]+$/u.test(card.name.trim())) {
    errors.cardName = "A name on a card has no digits or symbols in it.";
  }

  const expiry = expiryProblem(card.expiry);
  if (expiry) errors.cardExpiry = expiry;

  const cvv = digitsOf(card.cvv);
  const cvvSize = cvvLength(brand);
  if (cvv.length !== cvvSize) {
    errors.cardCvv = `The security code is ${cvvSize} digits${
      brand === "Amex" ? " on the front of an Amex" : " on the back"
    }.`;
  }

  return errors;
}

/** Every rule for one step. An empty object means the step may be left. */
export function validateStep(step: StepId, draft: CheckoutDraft): Errors {
  switch (step) {
    case "contact":
      return contactErrors(draft);
    case "address":
      return addressErrors(draft);
    case "payment":
      return paymentErrors(draft);
  }
}

/** Every rule, for the moment the checkout button is pressed. */
export function validateAll(draft: CheckoutDraft): Errors {
  return STEP_ORDER.reduce<Errors>((all, step) => ({ ...all, ...validateStep(step, draft) }), {});
}

/** The first step that still has something wrong with it, or null. */
export function firstBrokenStep(draft: CheckoutDraft): StepId | null {
  return STEP_ORDER.find((step) => hasErrors(validateStep(step, draft))) ?? null;
}

export function hasErrors(errors: Errors) {
  return Object.keys(errors).length > 0;
}
