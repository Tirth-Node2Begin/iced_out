/**
 * Stock, one row per item — what it is, which sizes it comes in, which
 * warehouse holds it, how many pieces are there, and how many of those an
 * order has already claimed.
 *
 * `available` is deliberately not a field. It is always
 * `totalUnits - reservedUnits`, so storing it would be storing a number that
 * can disagree with the two it comes from. Read it with `availableUnits`.
 */
export type StockItem = {
  id: string;
  itemName: string;
  /** "Top" or "Bottom" — the half of the body it goes on, and nothing more. */
  category: string;
  /** The garment within that category: a hoodie, a pair of cargos. */
  itemType: string;
  /** Comma separated — every record in this console is a flat map of strings. */
  sizes: string;
  warehouse: string;
  totalUnits: string;
  reservedUnits: string;
};

export const CATEGORIES = ["Top", "Bottom"];

/**
 * Who a garment is cut for.
 *
 * Kept here rather than fetched, unlike the three lists above: this one is not a
 * settings vocabulary. `products.audience` is a CHECK-constrained column with
 * exactly these three values, and the storefront's gender pages branch on them —
 * adding a fourth would be a schema change and a routing change, not a setting.
 *
 * `Unisex` shows on both gender pages, which is why it is the default rather than
 * a third page nobody visits.
 */
export const AUDIENCES = ["Men", "Women", "Unisex"];

/**
 * What a garment can be, per category.
 *
 * Split rather than pooled because "Cargo" is not a thing a top can be, and a
 * list that offers it anyway is a list that invites a wrong record.
 */
export const TYPES_BY_CATEGORY: Record<string, string[]> = {
  Top: ["T-shirt", "Shirt", "Hoodie", "Overshirt", "Jacket"],
  Bottom: ["Jeans", "Cargo", "Casual", "Joggers", "Shorts"],
};

/**
 * How a garment is sized, per category.
 *
 * A top is sized by letter and a bottom by waist inches. They are genuinely
 * different vocabularies, so the form asks the category first and then offers
 * only the sizes that category actually has — an "XL waist" is not a size
 * anyone can pick or stock.
 */
export const SIZES_BY_CATEGORY: Record<string, string[]> = {
  Top: ["S", "M", "L", "XL", "XXL"],
  Bottom: ["30", "32", "34", "36", "38", "40", "42"],
};

export const WAREHOUSE_CODES = ["BLR-01", "DEL-01", "MUM-01"];

/** At or under this many sellable pieces, an item is worth replenishing. */
export const LOW_STOCK_AT = 4;

/* The five ITM-* demo items that used to sit here are gone: the register reads
   `/admin/inventory/items`, so what is on screen is what the warehouses hold.
   What stays is the vocabulary — the categories, the types and the sizes each
   category comes in — and `availableUnits`/`stockLevel`, which are the two rules
   every screen applies to a stock row. */

/** Pieces a shopper can still buy: everything not already spoken for. */
export function availableUnits(item: { totalUnits: string; reservedUnits: string }) {
  return Math.max(0, Number(item.totalUnits || 0) - Number(item.reservedUnits || 0));
}

/**
 * How urgent an item is, read off `available` rather than stored.
 *
 * The stock register itself does not show this — an operator there wants the
 * three counts, not a verdict on them. It exists for the dashboard, whose whole
 * job is to say which registers need someone today.
 */
export function stockLevel(item: { totalUnits: string; reservedUnits: string }) {
  const available = availableUnits(item);
  if (available === 0) return "Out";
  return available <= LOW_STOCK_AT ? "Low" : "Healthy";
}
