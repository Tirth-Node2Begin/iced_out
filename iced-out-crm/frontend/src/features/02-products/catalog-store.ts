"use client";

import { adminClient } from "@/api/clients";
import type { Product } from "@/features/02-products/types/product";
import { createRemoteStore } from "@/lib/remote-store";

/**
 * The catalogue, for the screens in this app that need a PRICE rather than a
 * product page.
 *
 * The storefront's copy of this file reads `GET /catalog/products` — the public
 * endpoint, published rows only. That endpoint does not exist on this backend
 * and never will: the CRM serves `/admin/**` and nothing else, so the shop's
 * copy of this store would 404 on every call here.
 *
 * This reads `GET /admin/catalog/products` instead, which is the same table seen
 * from the operator's side. Two differences that matter, and both are the right
 * way round for this app:
 *
 *   · it includes DRAFT rows. A return can name a piece that has since been
 *     unpublished, and an exchange balance that silently valued it at zero
 *     because the shop stopped selling it would be wrong in the customer's
 *     favour or against it, at random.
 *   · `price` arrives FORMATTED ("₹8,900"), because every console register
 *     renders what the server hands it. The exchange maths needs a number, so it
 *     is parsed back here — once, at the boundary — rather than at each of the
 *     four call sites that would otherwise each get it slightly wrong.
 *
 * Who reads it: the returns and exchanges screens, through `useCatalog()`. The
 * catalogue REGISTER — the editable one behind `/catalog/products` — is a
 * different thing entirely and lives in `catalog-context.tsx`.
 */

/** `"₹8,900"` → `8900`. Anything unparseable is 0, which the callers treat as unpriced. */
function toRupees(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  /* Strip the sign and the Indian grouping. A decimal point survives — the
     column is DECIMAL(12,2) and a price with paise is legal, even if the
     storefront never shows them. */
  const digits = value.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(digits);

  return Number.isFinite(parsed) ? parsed : 0;
}

type ConsoleProductRow = {
  id?: string;
  name?: string;
  price?: unknown;
  status?: string;
  category?: string;
  collection?: string;
  image?: string;
};

export const catalogStore = createRemoteStore<Product>(async () => {
  const response = await adminClient.get<{ data: ConsoleProductRow[] }>("/admin/catalog/products");
  const rows = response.data.data ?? [];

  /* Only the fields the exchange maths reads are promised. The console row is
     not a storefront `Product` — it has no variants, no gallery, no destination
     — so this is a deliberate partial cast rather than a pretence that it is
     one. Anything reaching for a field that is not here would be reaching for
     something this endpoint was never going to carry. */
  return rows.map(
    (row) =>
      ({
        id: row.id ?? "",
        name: row.name ?? "",
        price: toRupees(row.price),
        status: row.status ?? "",
        category: row.category ?? "",
        collection: row.collection ?? "",
        image: row.image ?? "",
      }) as unknown as Product,
  );
});

/** Held rows without triggering a load — for a synchronous lookup that can miss. */
export function heldProducts(): Product[] {
  return catalogStore.peek().data;
}
