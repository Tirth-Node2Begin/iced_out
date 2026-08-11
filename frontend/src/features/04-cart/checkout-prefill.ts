/**
 * Turning what the account already knows into a filled-in checkout.
 *
 * The address book stores a destination the way a label is printed — a name, a
 * couple of free-text lines and a phone number — because that is the shape the
 * profile screens show it in. Checkout needs the same destination as separate
 * city / state / PIN fields, so something has to take one apart, and this is
 * that something. It lives beside checkout rather than beside the address book
 * on purpose: the book's shape is the source of truth, and the day it grows
 * real fields this file is the only thing that has to be deleted.
 *
 * The parse is best-effort by design. A line it cannot read becomes an empty
 * field the shopper fills in, never a wrong one they have to notice and undo —
 * a checkout that silently ships to a mis-parsed city is worse than one that
 * asks.
 */

import type { Address } from "@/features/01-users/addresses-context";
import type { CheckoutDraft } from "@/features/04-cart/checkout-context";
import type { CustomerProfile } from "@/features/01-users/profile-context";

/** `Bengaluru, Karnataka 560001` → the three fields checkout asks for. */
function splitRegionLine(line: string) {
  const pin = line.match(/(\d{6})\s*$/)?.[1] ?? "";
  const withoutPin = line.replace(/\s*\d{6}\s*$/, "").trim();
  const [city = "", ...rest] = withoutPin.split(",").map((part) => part.trim());
  return { city, state: rest.join(", "), postalCode: pin };
}

/**
 * A saved address, as checkout fields.
 *
 * The region line is found by looking for the PIN rather than by taking the
 * last entry: a book entry may carry a landmark line after it, and treating
 * "Opposite the metro" as a city is exactly the silent wrong answer this is
 * trying to avoid.
 */
export function addressToDraft(address: Address): Partial<CheckoutDraft> {
  const regionIndex = address.lines.findIndex((line) => /\d{6}\s*$/.test(line));
  const region = regionIndex >= 0 ? splitRegionLine(address.lines[regionIndex]) : null;
  const street = (regionIndex >= 0 ? address.lines.slice(0, regionIndex) : address.lines)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

  const patch: Partial<CheckoutDraft> = {
    address: street,
    city: region?.city ?? "",
    state: region?.state ?? "",
    postalCode: region?.postalCode ?? "",
  };

  if (address.name.trim()) patch.name = address.name.trim();

  /* The book masks the phone for display (`+91 ••••• 43210`). A mask is not a
     number, and putting one in a field the courier dials is worse than leaving
     it for the profile's copy to fill. */
  if (!address.phone.includes("•") && address.phone.replace(/\D/g, "").length >= 10) {
    patch.mobile = address.phone;
  }

  return patch;
}

/** `12 Preview Street · Bengaluru, Karnataka 560001` for the picker chips. */
export function addressSummary(address: Address) {
  return address.lines.filter(Boolean).join(" · ");
}

/** Who the shopper is, as checkout fields. */
export function profileToDraft(profile: CustomerProfile): Partial<CheckoutDraft> {
  return { name: profile.name, email: profile.email, mobile: profile.mobile };
}

/**
 * The patch that fills the HOLES in a draft and touches nothing else.
 *
 * Prefill is a convenience, not an authority: the shopper's own typing outranks
 * the account record every time, and a screen that quietly replaces an address
 * someone has just edited — on a re-render, on a tab focus, on a save in
 * another tab — is a screen that cannot be trusted with a delivery.
 */
export function fillGaps(draft: CheckoutDraft, source: Partial<CheckoutDraft>) {
  const patch: Partial<CheckoutDraft> = {};

  for (const [key, value] of Object.entries(source) as Array<
    [keyof CheckoutDraft, string | undefined]
  >) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    if (draft[key].trim().length > 0) continue;
    patch[key] = value as never;
  }

  return patch;
}
