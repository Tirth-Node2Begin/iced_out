"use client";

import { Boxes, CheckCircle2, Clock3, FileEdit, Package } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useCatalogRegisters } from "@/features/02-products/catalog-context";
import { PRODUCT_STATES } from "@/features/02-products/catalog-seed";
import { CatalogTabs } from "@/features/02-products/components/catalog-tabs";
import {
  listableItems,
  listableSizes,
  listingRoom,
  nothingListable,
} from "@/features/02-products/listing";
import { available, findStockItem, useStock } from "@/features/03-inventory/stock-context";

/**
 * The product register.
 *
 * A product is not typed here — it is *chosen*. Stock arrives in the inventory
 * register first, and listing a product is the decision to sell one of those
 * items in one of the sizes it is actually stocked in, so both of those are
 * dropdowns fed by that register rather than free text somebody could spell
 * differently. The slug and the stock code are minted from the item's name.
 *
 * The available count is read live off inventory rather than copied into the
 * product, so it cannot go stale: reserve pieces on the stock screen and this
 * one is already showing the smaller number.
 */
const FIELDS_BASE: FormField[] = [
  /* Filled in from the chosen stock item — see `autofill` — and editable, because
     a launch price that differs from the warehouse price is a real decision. */
  { key: "price", label: "Price", placeholder: "₹8,900", required: true, help: "Starts at the stock item's price. Change it here to list at something else." },
  /* A new product starts as a draft — publishing is a decision, not a default
     nobody made. */
  { key: "status", label: "State", type: "select", options: PRODUCT_STATES, initial: "Draft" },
];

function count(rows: RecordRow[], status: string) {
  return String(rows.filter((row) => row.status === status).length).padStart(2, "0");
}

export function AdminCatalogWorkspace() {
  const { products, categories, collections, register, error } = useCatalogRegisters();
  const productRegister = register("products");
  const { items } = useStock();

  /* The live registers, not lists written out here: a category that only exists
     in this file is a product filed under nothing. */
  const categoryNames = useMemo(
    () => categories.map((row) => row.name).filter(Boolean),
    [categories],
  );
  const collectionNames = useMemo(
    () => collections.map((row) => row.name).filter(Boolean),
    [collections],
  );

  /* The item's choices carry its available count, and the size's choices are a
     question about whichever item is currently picked — see `optionsFor`. */
  const fields: FormField[] = useMemo(
    () => [
      {
        key: "item",
        label: "Inventory item",
        type: "select",
        /* Everything in stock is listed, but an item with nothing left to give
           is held rather than hidden — the label says which ceiling it hit. */
        optionsFor: (_values, previous) => listableItems(items, products, previous),
        required: true,
        full: true,
        help: "Only what the warehouses actually hold. The count is what is left to sell.",
      },
      {
        key: "size",
        label: "Size",
        type: "select",
        optionsFor: (values, previous) =>
          listableSizes(items, products, values.item ?? "", previous),
        required: true,
        help: "The sizes this item is stocked in and has not been listed in yet.",
      },
      ...FIELDS_BASE,
      /**
       * Where it is filed, and what it is.
       *
       * These were not on the form at all, so a product created here had no
       * category — which meant it appeared under none of the storefront's filter
       * pills — and no description, which meant its product page opened with an
       * empty paragraph. Both vocabularies are the console's own registers, so a
       * category added on the Categories tab is on offer here immediately.
       */
      {
        key: "category",
        label: "Category",
        type: "select",
        options: categoryNames,
        help: "What the storefront's filter pills group it under.",
      },
      {
        key: "collection",
        label: "Collection",
        type: "select",
        options: collectionNames,
      },
      {
        key: "image",
        label: "Photo",
        type: "image",
        full: true,
        help: "Filled in from the stock item, and replaceable here. Shown on the card, the product page and the bag — a product without one falls back to the house sprite.",
      },
      {
        key: "description",
        label: "Short description",
        type: "textarea",
        full: true,
        placeholder: "A dense, garment-washed hoodie cut with a dropped shoulder…",
        help: "The paragraph under the price on the product page.",
      },
    ],
    [categoryNames, collectionNames, items, products],
  );

  const columns: Column[] = useMemo(
    () => [
      {
        key: "name",
        label: "Product",
        primary: true,
        sub: "sku",
        /* The photo beside the name, the way the inventory register shows its
           items — a catalogue you cannot see is a list of words. */
        render: (row) => (
          <span className="aui-cellmedia">
            {row.image ? (
              /* A runtime API URL, which the static export's image optimiser has
                 no build-time way to resolve. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img alt="" className="aui-cellmedia__img" src={row.image} />
            ) : null}
            <span className="aui-table__primary">
              <strong>{row.name || "—"}</strong>
              {row.sku && <small>{row.sku}</small>}
            </span>
          </span>
        ),
        exportValue: (row) => row.name ?? "",
      },
      { key: "size", label: "Size", align: "center" },
      {
        key: "available",
        label: "Available",
        align: "right",
        numeric: true,
        render: (row) => availableFor(items, row),
        exportValue: (row) => String(availableFor(items, row) ?? ""),
      },
      { key: "price", label: "Price", align: "right", numeric: true },
      { key: "status", label: "State", status: true },
    ],
    [items],
  );

  /**
   * The name follows from the item that was chosen.
   *
   * The slug and the stock code no longer do: those are minted by the SERVER
   * (`SkuMinter`), because a slug is a URL somebody may keep and the code is
   * stamped on every SKU beneath it — both have to be unique against the whole
   * database, which is a question only the database can answer. Two operators
   * listing "Afterdark Hoodie" at the same moment used to mint the same slug in
   * two browsers and neither would have known.
   *
   * The name still tracks the item, so re-pointing a listing at a different
   * stock record does not leave the old item's name on the row.
   */
  const derive = useMemo(
    () => (values: RecordRow, _rows: RecordRow[], previous?: RecordRow) => ({
      ...values,
      name: findStockItem(items, values.item ?? "")?.itemName ?? previous?.name ?? "",
    }),
    [items],
  );

  /**
   * The item answers the rest of the form.
   *
   * A listing is a decision to sell a garment that has already been described:
   * what it costs and what it looks like were recorded when the stock was taken
   * in, so asking for them again here was asking an operator to copy two facts
   * off another screen — and to be the reason the two ever disagreed.
   *
   * Everything filled in is still editable. This is a starting point, not a
   * lock: a launch price that differs from the warehouse price is a real thing,
   * and typing over the box is how you say so.
   *
   * `derive` cannot do this — it runs at submit, on values nobody can still see.
   */
  const autofill = useMemo(
    () => (changed: string | null, values: RecordRow) => {
      /* `null` is the dialog opening on whichever item the dropdown starts on —
         see `autofill` on the register. */
      if (changed !== null && changed !== "item") return null;

      const item = findStockItem(items, values.item ?? "");
      if (!item) return null;

      const filled: RecordRow = {};

      /* Only where the box is empty or still holds the LAST item's answer. An
         operator who has typed a price and then corrected the item they picked
         must not watch their number be overwritten. */
      if (item.price) filled.price = item.price;
      if (item.image) filled.image = item.image;

      /* The item's garment type — "Jeans", "Hoodie" — where the catalogue has a
         category by that name. It usually does; where it does not, the field is
         left for the operator rather than filled with something that is not on
         the list. */
      const match = categoryNames.find(
        (name) => name.toLowerCase() === (item.itemType ?? "").toLowerCase(),
      );
      if (match) filled.category = match;

      return filled;
    },
    [categoryNames, items],
  );

  /**
   * A first answer, ahead of the server's.
   *
   * The API enforces all of this itself — it re-checks the listing room inside
   * the transaction that would create the product, which is the only place the
   * check is actually safe. This is here so the common refusals are instant and
   * land next to the field that has to change, rather than after a round trip.
   * The server is the wall; this is the sign on it.
   */
  const validate = useMemo(
    () => (values: RecordRow, rows: RecordRow[], previous?: RecordRow) => {
      const item = findStockItem(items, values.item ?? "");
      if (!item) return "That stock item is no longer in inventory.";

      const clash = rows.find(
        (row) =>
          row.item === values.item && row.size === values.size && row.id !== previous?.id,
      );
      if (clash) {
        return `${item.itemName} is already listed in size ${values.size} — as ${clash.name}, ${clash.status.toLowerCase()}.`;
      }

      /* An edit that stays on the same item is not a new claim on it, so it is
         only the room for one more that has to be there. */
      if (previous?.item === values.item) return null;

      const state = listingRoom(items, rows, values.item ?? "", previous);
      return state.reason
        ? `${item.itemName} cannot take another listing: ${state.reason}.`
        : null;
    },
    [items],
  );

  const exhausted = nothingListable(items, products);

  const stats: Stat[] = [
    { label: "Products", value: String(products.length).padStart(2, "0"), icon: Package, tone: "sky", note: "Listed from stock" },
    { label: "Published", value: count(products, "Published"), icon: CheckCircle2, tone: "mint", note: "Live on the storefront" },
    { label: "Scheduled", value: count(products, "Scheduled"), icon: Clock3, tone: "amber", note: "Waiting on a release" },
    { label: "Draft", value: count(products, "Draft"), icon: FileEdit, tone: "violet", note: "Not visible to shoppers" },
  ];

  return (
    <AdminPage
      eyebrow="Catalog"
      icon={Package}
      lede="List what the warehouses actually hold. Pick a stock item and one of the sizes it comes in — the slug and the stock code are minted for you, and the available count is read straight off inventory."
      spec={[
        { label: "Products", value: String(products.length).padStart(2, "0") },
        { label: "Published", value: count(products, "Published") },
        { label: "Draft", value: count(products, "Draft") },
      ]}
      title={
        <>
          Product <em>catalogue</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        autofill={autofill}
        columns={columns}
        derive={derive}
        emptyHint="Nothing is listed yet. Add a product to put one of your stock items in front of shoppers."
        fields={fields}
        error={error}
        filterKey="status"
        filterValues={PRODUCT_STATES}
        icon={Package}
        loaded={productRegister.loaded}
        loading={productRegister.loading}
        onCreate={productRegister.onCreate}
        onDelete={productRegister.onDelete}
        onUpdate={productRegister.onUpdate}
        rowHref={(row) => `/admin/catalog/products/edit?id=${encodeURIComponent(row.id)}`}
        rows={products}
        searchKeys={["name", "sku", "id", "size", "price", "status"]}
        singular="product"
        toolbarLead={<CatalogTabs />}
        tone="sky"
        validate={validate}
      >
        {items.length === 0 && (
          /* Nothing to list is not a broken form — it is a step that has not
             happened yet, so the screen says which one and where it is. */
          <Note icon={Boxes} title="No stock to list yet" tone="warn">
            A product is chosen from what the warehouses hold, and there is nothing in them.{" "}
            <Link className="aui-link" href="/admin/inventory/overview">
              Add an item to inventory
            </Link>{" "}
            and it will be on offer here.
          </Note>
        )}

        {exhausted && (
          /* Said here rather than only inside the dialog, so the answer is on
             the screen before the button that leads to a form with nothing in
             it — and it names the fix, which is upstream. */
          <Note icon={Boxes} title="Everything in stock is already listed" tone="warn">
            Every item has a listing for each size it is stocked in, or has no pieces left to
            sell.{" "}
            <Link className="aui-link" href="/admin/inventory/overview">
              Take more stock in
            </Link>{" "}
            and it can be listed here.
          </Note>
        )}
      </RecordManager>
    </AdminPage>
  );
}

/**
 * What is left of the stock this product sells from.
 *
 * `null` where the item is gone rather than 0: nothing available and no longer
 * stocked at all are different facts, and showing the second as the first would
 * read as "sold out" for a product whose warehouse record has been deleted.
 */
function availableFor(items: RecordRow[], row: RecordRow) {
  const item = findStockItem(items, row.item ?? "");
  return item ? available(item) : null;
}
