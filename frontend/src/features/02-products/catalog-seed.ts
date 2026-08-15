import type { RecordRow } from "@/components/admin/record-manager";

/**
 * What the catalogue holds before anyone touches it, and the rules for the two
 * fields nobody types.
 *
 * Kept out of `catalog-context` and kept free of `"use client"`: it is plain
 * data and pure functions, so it is testable on its own, it costs a server
 * component nothing to read — an export pulled across a client boundary
 * arrives on the server as a reference proxy rather than the value it looks
 * like — and the store beside it stays about storage.
 */
export type CatalogRecord = RecordRow;

export type CatalogKind = "products" | "categories" | "collections" | "variants";

export type Catalog = Record<CatalogKind, CatalogRecord[]>;

/** The vocabulary of states, and the order the filter chips sit in. */
export const PRODUCT_STATES = ["Published", "Scheduled", "Draft"];
export const COLLECTION_STATES = ["Published", "Scheduled", "Draft"];
export const VARIANT_STATES = ["Active", "Low", "Out", "Archived"];

/**
 * Sizes for a product whose stock record has gone.
 *
 * A product's real vocabulary comes from the inventory item it sells from —
 * letters for a top, waist inches for a bottom — and is asked for there. This
 * is only what is left to offer when that item can no longer be found, so the
 * variant form still has something to show rather than an empty menu.
 */
export const FALLBACK_SIZES = ["S", "M", "L", "XL"];

export const SEEDED: Catalog = {
  /* Every one of these is an inventory item that has been listed — `item` is
     the stock record it sells from, which is what lets the register show a
     live available count instead of a number copied at seed time. */
  products: [
    { id: "afterdark-hoodie", name: "Afterdark Hoodie", item: "ITM-001", size: "M", sku: "ADH", price: "₹8,900", status: "Published", category: "Outerwear", collection: "Drop 001" },
    { id: "bone-utility-overshirt", name: "Bone Utility Overshirt", item: "ITM-002", size: "S", sku: "BUO", price: "₹12,400", status: "Draft", category: "Outerwear", collection: "After Hours" },
    { id: "midnight-denim", name: "Midnight Denim", item: "ITM-005", size: "34", sku: "MDD", price: "₹7,800", status: "Scheduled", category: "Bottoms", collection: "After Hours" },
    { id: "core-heavy-tee", name: "Core Heavy Tee", item: "ITM-003", size: "M", sku: "CHT", price: "₹4,600", status: "Published", category: "Essentials", collection: "Core Uniform" },
    { id: "shadow-cargo-02", name: "Shadow Cargo 02", item: "ITM-004", size: "32", sku: "SC2", price: "₹11,200", status: "Draft", category: "Bottoms", collection: "Core Uniform" },
  ],
  categories: [
    { id: "outerwear", name: "Outerwear", products: "14" },
    { id: "essentials", name: "Essentials", products: "22" },
    { id: "bottoms", name: "Bottoms", products: "9" },
    { id: "accessories", name: "Accessories", products: "6" },
  ],
  collections: [
    { id: "drop-001", name: "Drop 001", pieces: "4", status: "Published" },
    { id: "after-hours", name: "After Hours", pieces: "8", status: "Scheduled" },
    { id: "core-uniform", name: "Core Uniform", pieces: "6", status: "Draft" },
  ],
  /* One flat register keyed by the product it belongs to, rather than a list
     nested inside each product: it is the same shape every other register in
     the console has, so the editor's variants table is the same component with
     the same verbs — and a product with none is a product with none, not a
     missing field. */
  variants: [
    { id: "ADH-WSB-S", product: "afterdark-hoodie", size: "S", colour: "Washed black", stock: "4", status: "Active" },
    { id: "ADH-WSB-M", product: "afterdark-hoodie", size: "M", colour: "Washed black", stock: "12", status: "Active" },
    { id: "ADH-WSB-L", product: "afterdark-hoodie", size: "L", colour: "Washed black", stock: "2", status: "Low" },
    { id: "ADH-BON-M", product: "afterdark-hoodie", size: "M", colour: "Bone", stock: "0", status: "Out" },
    { id: "BUO-BON-S", product: "bone-utility-overshirt", size: "S", colour: "Bone", stock: "6", status: "Active" },
    { id: "BUO-BON-M", product: "bone-utility-overshirt", size: "M", colour: "Bone", stock: "3", status: "Low" },
    { id: "MDD-IND-34", product: "midnight-denim", size: "34", colour: "Indigo", stock: "18", status: "Active" },
    { id: "CHT-BON-M", product: "core-heavy-tee", size: "M", colour: "Bone", stock: "22", status: "Active" },
    { id: "CHT-BON-L", product: "core-heavy-tee", size: "L", colour: "Bone", stock: "9", status: "Active" },
    { id: "SC2-SLT-32", product: "shadow-cargo-02", size: "32", colour: "Slate", stock: "5", status: "Active" },
  ],
};

/* ------------------------------------------------------------ minted ids */

/**
 * A name, as a URL segment.
 *
 * Operators do not type slugs any more — the create form asks for a name and
 * this is what the catalogue files it under.
 */
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The first free form of a value: `after-hours`, then `after-hours-2`, … */
function firstFree(base: string, taken: Set<string>, join: (root: string, n: number) => string) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(join(base, n))) n += 1;
  return join(base, n);
}

export function mintSlug(name: string, taken: Iterable<string>) {
  const base = slugify(name) || "record";
  return firstFree(base, new Set(taken), (root, n) => `${root}-${n}`);
}

/**
 * The three-character stock code a product's SKUs are built from.
 *
 * Initials first — "Core Heavy Tee" is CHT, "Signal Puffer" is SGP — and a
 * two-word name is filled out with the next consonant of the first word rather
 * than a letter nobody would guess. A repeat takes the next number after it
 * (ADH, ADH2), so the code is always unique without ever being opaque.
 */
export function skuCode(name: string) {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]).join("");

  if (initials.length >= 3) return initials.slice(0, 3);

  const rest = (words[0] ?? "").slice(1);
  const filler = `${rest.replace(/[AEIOU]/g, "")}${rest}XXX`;
  const need = 3 - initials.length;

  /* Inserted after the first letter, not appended: AFH reads as a code for
     "Afterdark Hoodie"; AHF reads as a typo. */
  return `${initials.slice(0, 1)}${filler.slice(0, need)}${initials.slice(1)}`;
}

export function mintSku(name: string, taken: Iterable<string>) {
  return firstFree(skuCode(name) || "SKU", new Set(taken), (root, n) => `${root}${n}`);
}

/**
 * One variant's SKU: the product's code, the colour's code, the size.
 *
 * `ADH-WSB-L` reads on a picking slip and in a stock count without a lookup,
 * which is the whole job of a SKU. Like the product's own code it is minted
 * once and then held — a colour renamed on a variant that has already shipped
 * must not silently re-label the thing in the box.
 */
export function mintVariantSku(
  productSku: string,
  colour: string,
  size: string,
  taken: Iterable<string>,
) {
  const base = [productSku || "SKU", skuCode(colour) || "GEN", size || "OS"].join("-");
  return firstFree(base, new Set(taken), (root, n) => `${root}-${n}`);
}
