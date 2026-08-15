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
import { useCatalog } from "@/features/02-products/catalog-context";
import { PRODUCT_STATES, mintSku, mintSlug } from "@/features/02-products/catalog-seed";
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
  { key: "price", label: "Price", placeholder: "₹8,900", required: true },
  /* A new product starts as a draft — publishing is a decision, not a default
     nobody made. */
  { key: "status", label: "State", type: "select", options: PRODUCT_STATES, initial: "Draft" },
];

function count(rows: RecordRow[], status: string) {
  return String(rows.filter((row) => row.status === status).length).padStart(2, "0");
}

export function AdminCatalogWorkspace() {
  const { products, commit } = useCatalog();
  const { items } = useStock();

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
    ],
    [items, products],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Product", primary: true, sub: "sku" },
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
   * The name, slug and stock code all follow from the item that was chosen.
   *
   * The slug and code are minted once and then held — a slug is a URL someone
   * may hold and the code is stamped on every SKU beneath it — but the name
   * tracks the item, so re-pointing a listing at a different stock record does
   * not leave the old item's name on the row.
   */
  const derive = useMemo(
    () => (values: RecordRow, rows: RecordRow[], previous?: RecordRow) => {
      const name = findStockItem(items, values.item ?? "")?.itemName ?? previous?.name ?? "";
      if (previous) return { ...values, name };

      return {
        ...values,
        name,
        id: mintSlug(name, rows.map((row) => row.id)),
        sku: mintSku(name, rows.map((row) => row.sku).filter(Boolean)),
      };
    },
    [items],
  );

  /**
   * The wall behind the disabled options.
   *
   * The form already refuses to offer an exhausted item or a size that is
   * spoken for, so nothing reachable through it should land here. What can is
   * a dialog that was opened while there was still room and submitted after
   * another tab — or the inventory screen, reserving pieces — took the last of
   * it. The rule is checked against the register as it stands at submit.
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
        columns={columns}
        derive={derive}
        emptyHint="Nothing is listed yet. Add a product to put one of your stock items in front of shoppers."
        fields={fields}
        filterKey="status"
        filterValues={PRODUCT_STATES}
        icon={Package}
        onCommit={(next) => commit("products", next)}
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
