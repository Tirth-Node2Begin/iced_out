import type { RecordRow } from "@/components/admin/record-manager";
import { available, findStockItem, sizesOf } from "@/features/03-inventory/stock-context";

/**
 * How much of a stock item is still there to list, and why not when it is none.
 *
 * A listing is a size and a piece at once, so an item runs out two ways and
 * whichever comes first is the one that stops it:
 *
 * - every size it is stocked in already has a listing, so there is nothing left
 *   to put in front of a shopper;
 * - there are as many listings as there are sellable pieces, so the next one
 *   would be promising stock the warehouse does not have.
 *
 * State does not enter into it. A draft listing has already claimed its size
 * and its piece — it is the thing that will be published — so counting only the
 * published ones would let the same stock be listed twice and go wrong at the
 * moment both were made live.
 */
export type ListingRoom = {
  /** How many more listings this item can take. */
  room: number;
  /** The sizes with no listing yet, in the order the warehouse states them. */
  unlisted: string[];
  /** Sellable pieces behind it, for a label. */
  available: number;
  /**
   * Why there is no room, or null while there is — two lengths, because the
   * two places this is read have very different room for it. `tag` rides in a
   * dropdown option beside the item's name and has to stay glanceable; `reason`
   * is the sentence a refusal is explained with.
   */
  tag: string | null;
  reason: string | null;
};

export function listingRoom(
  items: RecordRow[],
  products: RecordRow[],
  itemId: string,
  /** A listing being edited does not count against itself. */
  exclude?: RecordRow,
): ListingRoom {
  const item = findStockItem(items, itemId);
  if (!item) {
    return {
      room: 0,
      unlisted: [],
      available: 0,
      tag: "Not in stock",
      reason: "it is no longer in inventory",
    };
  }

  const sellable = available(item);
  const listings = products.filter(
    (product) => product.item === itemId && product.id !== exclude?.id,
  );
  const listed = new Set(listings.map((product) => product.size));
  const unlisted = sizesOf(items, itemId).filter((size) => !listed.has(size));
  const spare = sellable - listings.length;

  const room = Math.max(0, Math.min(unlisted.length, spare));
  const stopped = room > 0 ? null : stop(sellable, spare);

  return {
    room,
    unlisted,
    available: sellable,
    tag: stopped?.tag ?? null,
    reason: stopped?.reason ?? null,
  };
}

function stop(sellable: number, spare: number) {
  if (sellable === 0) {
    return { tag: "Out of stock", reason: "there is nothing available to sell" };
  }
  if (spare <= 0) {
    return {
      tag: "All pieces listed",
      reason: `all ${sellable} available ${sellable === 1 ? "piece is" : "pieces are"} already listed`,
    };
  }
  return {
    tag: "All sizes listed",
    reason: "every size it is stocked in is already listed",
  };
}

/**
 * The stock items as choices, the exhausted ones shown but held.
 *
 * The tag names which ceiling was hit rather than just greying the row out,
 * because "out of stock" and "all sizes listed" are two different problems with
 * two different fixes — restock one, and there is nothing to fix on the other.
 */
export function listableItems(items: RecordRow[], products: RecordRow[], exclude?: RecordRow) {
  return items.map((item) => {
    const state = listingRoom(items, products, item.id, exclude);
    return {
      value: item.id,
      label: `${item.itemName} · ${state.tag ?? `${state.available} available`}`,
      disabled: state.tag !== null,
    };
  });
}

/** The sizes of one item that are still free to list. */
export function listableSizes(
  items: RecordRow[],
  products: RecordRow[],
  itemId: string,
  exclude?: RecordRow,
) {
  return listingRoom(items, products, itemId, exclude).unlisted;
}

/** True when nothing in stock can take another listing. */
export function nothingListable(items: RecordRow[], products: RecordRow[]) {
  return items.length > 0 && items.every((item) => listingRoom(items, products, item.id).room === 0);
}
