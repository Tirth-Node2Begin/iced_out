/**
 * A saved address, as the fields a form asks for — and back again.
 *
 * The book stores a destination the way a label is printed: a couple of free
 * text lines. That is right for showing it and wrong for editing it, because a
 * form cannot put a cursor in "the pincode part of line two". So the composing
 * lived in every form that saved one (`${city}, ${state} ${pincode}`, written
 * out three times) and nothing did the taking-apart at all, which is why an
 * address could only ever be deleted and retyped.
 *
 * Both halves live here now, next to each other, so the round trip is one
 * thing to check rather than two that drift. The parse is deliberately the
 * same shape as `checkout-prefill`'s: find the line ending in a PIN, treat
 * everything before it as street. A line it cannot read comes back empty for
 * the shopper to fill, never wrong for them to notice later.
 */

import type { Address } from "@/features/01-users/addresses-context";

export type AddressFields = {
  label: string;
  name: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};

export const EMPTY_ADDRESS_FIELDS: AddressFields = {
  label: "",
  name: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
};

/** `["12 Preview Street", "Bengaluru, Karnataka 560001"]` → separate fields. */
export function addressToFields(address: Address): AddressFields {
  const regionIndex = address.lines.findIndex((line) => /\d{6}\s*$/.test(line));
  const regionLine = regionIndex >= 0 ? address.lines[regionIndex] : "";

  const pincode = regionLine.match(/(\d{6})\s*$/)?.[1] ?? "";
  const [city = "", ...rest] = regionLine
    .replace(/\s*\d{6}\s*$/, "")
    .split(",")
    .map((part) => part.trim());

  const street = (regionIndex >= 0 ? address.lines.slice(0, regionIndex) : address.lines)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

  return {
    label: address.label,
    name: address.name,
    street,
    city: regionIndex >= 0 ? city : "",
    state: regionIndex >= 0 ? rest.join(", ") : "",
    pincode,
    phone: address.phone,
  };
}

/** The fields, back as a record the book and the address cards can hold. */
export function fieldsToAddress(fields: AddressFields): Omit<Address, "id"> {
  const region = [
    [fields.city.trim(), fields.state.trim()].filter(Boolean).join(", "),
    fields.pincode.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    label: fields.label.trim() || "Address",
    name: fields.name.trim(),
    /* Dropped rather than kept blank: an empty line in the middle of a printed
       address is a gap the eye reads as missing information. */
    lines: [fields.street.trim(), region].filter(Boolean),
    phone: fields.phone.trim(),
  };
}

/** The same fields read straight off a submitted form. */
export function formDataToFields(form: FormData): AddressFields {
  const read = (key: keyof AddressFields) => String(form.get(key) ?? "");

  return {
    label: read("label"),
    name: read("name"),
    street: read("street"),
    city: read("city"),
    state: read("state"),
    pincode: read("pincode"),
    phone: read("phone"),
  };
}
