"use client";

import { BookmarkCheck, Boxes, PackageCheck, ShoppingBag } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Btn, Field, Modal } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { useRegisterList } from "@/api/use-register";
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";
import { AUDIENCES, availableUnits } from "@/features/03-inventory/data/stock-fixtures";
import { useStock } from "@/features/03-inventory/stock-context";
import { useInventoryVocabularies } from "@/features/03-inventory/vocabularies";

/**
 * The stock register — one row per item, and only four things to say about it:
 * what it is called, which sizes it comes in, which warehouse holds it, and how
 * many pieces are there.
 *
 * Reserving is the fifth thing, and it is deliberately not in the item form.
 * Adding an item and setting aside stock for an order are two different jobs
 * done at two different moments, so reserving is its own small dialog, reached
 * from the row it applies to. Available is then never typed by anyone — it is
 * always total minus reserved.
 */

const COLUMNS: Column[] = [
  {
    key: "itemName",
    label: "Item",
    primary: true,
    sub: "sizes",
    render: (item) => (
      <span className="aui-cellmedia">
        {item.image ? (
          /* A runtime API URL, which the static export's image optimiser has no
             build-time way to resolve. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img alt="" className="aui-cellmedia__img" src={item.image} />
        ) : null}
        <span>{item.itemName}</span>
      </span>
    ),
    exportValue: (item) => item.itemName ?? "",
  },
  {
    key: "itemType",
    label: "Type",
    hideSmall: true,
    render: (item) => typeLabel(item),
    exportValue: (item) => typeLabel(item),
  },
  /* Who the garment is cut for — which decides whether a product listed from it
     appears on /new-drop, on /women, or on both. */
  { key: "audience", label: "Audience", hideSmall: true },
  { key: "price", label: "Price", align: "right", numeric: true },
  { key: "warehouse", label: "Warehouse" },
  { key: "totalUnits", label: "Total pieces", align: "right", numeric: true },
  { key: "reservedUnits", label: "Reserved", align: "right", numeric: true },
  {
    key: "availableUnits",
    label: "Available",
    align: "right",
    numeric: true,
    render: (item) => availableUnits(asStockItem(item)),
    exportValue: (item) => String(availableUnits(asStockItem(item))),
  },
];

/**
 * Category is asked before type and sizes because both of them are answers to
 * it: a top is a hoodie sized S to XXL, a bottom is a pair of cargos sized by
 * the waist. Answering it changes what those two fields offer, so neither can
 * end up holding something the category does not have.
 */
const FIELDS: FormField[] = [
  { key: "itemName", label: "Item name", placeholder: "Afterdark Hoodie", full: true, required: true },
  /**
   * What the piece sells for.
   *
   * Asked here rather than only on the listing form, for the same reason the
   * audience is: it is a fact about the garment, decided when the stock is
   * priced, and a product listed from this item inherits it. Before this, the
   * number was first typed on a different screen, days later, from memory.
   *
   * Formatted the way the catalogue register shows it — the register strips it
   * back to whole rupees on the way out, so "₹8,900" and "8900" both work.
   */
  {
    key: "price",
    label: "Price",
    placeholder: "₹8,900",
    initial: "",
    help: "What one piece sells for. A listing made from this item starts here.",
  },
  { key: "totalUnits", label: "Total pieces", type: "number", initial: "0", required: true, help: "How many pieces are physically in that warehouse." },
];

export function InventoryWorkspace() {
  /* Read from the database rather than from this screen's state: the catalogue
     lists what is in here and a shopper's order reserves against it, so stock has
     to be the same fact for every surface — not just outlive the tab. */
  const { items, register, loading, error, ready } = useStock();
  /**
   * The warehouses, as the vocabulary for the item form's warehouse field.
   *
   * It was a hardcoded list of three codes, so a warehouse added on the
   * warehouses screen could never have stock filed into it — and the API rejects
   * a code it has no row for, which the form had no way of knowing.
   */
  const warehouses = useRegisterList("/admin/inventory/warehouses");
  /* Categories, sizes and types come from `store_settings`, not from a list in
     the frontend — see `vocabularies.ts` for what a stale copy cost. */
  const { categories, sizesByCategory, typesByCategory } = useInventoryVocabularies();
  const warehouseCodes = useMemo(
    () => warehouses.rows.map((row) => row.id).filter(Boolean),
    [warehouses.rows],
  );

  const fields = useMemo<FormField[]>(
    () => [
      ...FIELDS,
      /* Category first, because the two below are answers to it. */
      {
        key: "category",
        label: "Category",
        type: "select",
        options: categories,
        help: "Sets the type and sizes below.",
      },
      {
        key: "itemType",
        label: "Type",
        type: "select",
        optionsFor: (item) => typesByCategory[item.category] ?? [],
      },
      /**
       * Who it is cut for.
       *
       * Asked here rather than on the listing form because it is a fact about the
       * GARMENT, not about the decision to sell it — and a product listed from
       * this item inherits it. Every product created through the console used to
       * come out `unisex`, so a women's coat appeared on the men's page too.
       *
       * `Unisex` is the default and shows on both pages, which is the widest and
       * safest reading for an item nobody has decided about yet.
       */
      {
        key: "audience",
        label: "Audience",
        type: "select",
        options: AUDIENCES,
        initial: "Unisex",
        help: "Which gender page a product listed from this item appears on. Unisex shows on both.",
      },
      {
        key: "warehouse",
        label: "Warehouse",
        type: "select",
        options: warehouseCodes,
        required: true,
        help: "Where these pieces physically are.",
      },
      {
        key: "sizes",
        label: "Sizes",
        type: "chips",
        optionsFor: (item) => sizesByCategory[item.category] ?? [],
        required: true,
        full: true,
        help: "Pick every size this item is stocked in.",
      },
      /* Optional on purpose: an item that has arrived in the warehouse is worth
         recording before anyone has photographed it, and a form that refuses the
         record until there is a picture is a form people work around. */
      {
        key: "image",
        label: "Primary photo",
        type: "image",
        full: true,
        help: "The one frame that stands for this piece — on its card, in the bag and in this register.",
      },
      /**
       * Everything else the piece was shot from.
       *
       * Not per size: a coat photographs the same whichever waist it is cut to,
       * so these hang off the ITEM, and every listing made from it shows the
       * same run. The primary above leads; these follow it, in this order.
       */
      {
        key: "images",
        label: "More photos",
        type: "gallery",
        full: true,
        help: "The rest of the gallery — other angles, details, on a body. This is what the product page pages through.",
      },
      /**
       * Take the stock in and put it in the shop, in one gesture.
       *
       * Last on the form because it is the only field that is not a fact about
       * the garment — it is a decision about it, and it can only be made once
       * everything above has been answered. Off by default: publishing is a
       * decision somebody makes, not one that happens because nobody looked.
       *
       * Ticked, the server lists this item as a Published product with a variant
       * for every size it is stocked in, so a shopper can open its page and pick
       * a size straight away. Left alone, everything above is still stored — the
       * catalogue's own form offers the item in its dropdown and fills itself in
       * from what is recorded here.
       */
      {
        key: "publish",
        label: "Publish to the storefront now",
        type: "checkbox",
        full: true,
        createOnly: true,
        help: "Lists this straight away as a published product, sized as stocked. Leave it off to keep the details and list it from the Catalog screen later.",
      },
    ],
    [categories, sizesByCategory, typesByCategory, warehouseCodes],
  );

  /** The item whose reservation is being set, or nothing if the dialog is shut. */
  const [reservingItem, setReservingItem] = useState<RecordRow | undefined>(undefined);
  const [reserving, setReserving] = useState(false);

  const totals = useMemo(() => {
    const pieces = items.reduce((sum, item) => sum + Number(item.totalUnits || 0), 0);
    const reserved = items.reduce((sum, item) => sum + Number(item.reservedUnits || 0), 0);
    return { pieces, reserved, available: pieces - reserved };
  }, [items]);

  const stats: Stat[] = [
    { label: "Items", value: String(items.length).padStart(2, "0"), icon: ShoppingBag, tone: "violet", note: "In this register" },
    { label: "Total pieces", value: totals.pieces.toLocaleString("en-IN"), icon: Boxes, tone: "sky", note: "Across every warehouse" },
    { label: "Reserved", value: totals.reserved.toLocaleString("en-IN"), icon: BookmarkCheck, tone: "amber", note: "Held for orders" },
    { label: "Available", value: totals.available.toLocaleString("en-IN"), icon: PackageCheck, tone: "mint", note: "Free to sell" },
  ];

  /**
   * Saves a new reservation for the item the dialog was opened on.
   *
   * Its own endpoint — `POST /admin/inventory/items/{id}/reserve` — rather than a
   * field on the item PATCH. Reserved units are what orders are holding, and the
   * server writes a movement row for the change; letting the item form carry the
   * number would mean an operator editing a name could silently release stock an
   * order was depending on.
   */
  async function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservingItem) return;

    const typed = Number(new FormData(event.currentTarget).get("reservedUnits") ?? 0);
    /* Clamped rather than rejected: the input already says what the ceiling is,
       and refusing the form over a typo is worse than holding it at the ceiling. */
    const reserved = Math.min(Math.max(0, Math.round(typed)), Number(reservingItem.totalUnits || 0));

    setReserving(true);

    try {
      await register.act(
        `/admin/inventory/items/${encodeURIComponent(reservingItem.id)}/reserve`,
        { reservedUnits: reserved },
      );

      toast.success(`${reservingItem.itemName} · ${reserved} reserved`, {
        description: `${Number(reservingItem.totalUnits || 0) - reserved} pieces left to sell.`,
      });
      setReservingItem(undefined);
    } catch (caught) {
      toast.error("That reservation could not be saved", {
        description: caught instanceof Error ? caught.message : "The server refused the change.",
      });
    } finally {
      setReserving(false);
    }
  }

  return (
    <AdminPage
      eyebrow="Inventory · Stock"
      icon={Boxes}
      lede="Add an item as a top or a bottom and it asks for the sizes that category actually comes in. Say which warehouse holds it and how many pieces are there; reserve some for an order and the rest stays sellable."
      spec={[
        { label: "Items", value: String(items.length).padStart(2, "0") },
        { label: "Pieces", value: String(totals.pieces) },
        { label: "Available", value: String(totals.available) },
      ]}
      title={
        <>
          Stock <em>truth</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        emptyHint="Add your first item — a name, its sizes, a warehouse and how many pieces are there."
        error={error ?? warehouses.error}
        fields={fields}
        filterKey="warehouse"
        filtersBelow
        filterValues={warehouseCodes}
        icon={Boxes}
        /* The server mints the ITM-* code, so nothing here needs an id prefix. */
        loaded={ready}
        loading={loading}
        onCreate={register.onCreate}
        onDelete={register.onDelete}
        onUpdate={register.onUpdate}
        rowAction={(item) => ({
          icon: BookmarkCheck,
          label: `Reserve pieces of ${item.itemName}`,
          onSelect: () => setReservingItem(item),
        })}
        rows={items}
        searchKeys={["itemName", "category", "itemType", "sizes", "warehouse"]}
        singular="item"
        toolbarLead={<InventoryTabs />}
        tone="mint"
      />

      {/* Keyed on the item so reopening the dialog on a different row starts
          from that row's number rather than the last one typed. */}
      <Modal
        description="Reserved pieces are held for orders and drop straight out of what the storefront can sell."
        footer={
          <>
            <Btn disabled={reserving} onClick={() => setReservingItem(undefined)}>
              Cancel
            </Btn>
            <Btn disabled={reserving} form="reserve-form" type="submit" variant="solid">
              {reserving ? "Saving…" : "Save reservation"}
            </Btn>
          </>
        }
        icon={BookmarkCheck}
        onOpenChange={(open) => !open && setReservingItem(undefined)}
        open={reservingItem !== undefined}
        size="sm"
        title={reservingItem ? `Reserve ${reservingItem.itemName}` : "Reserve pieces"}
        tone="mint"
      >
        {reservingItem && (
          <form
            className="aui-form"
            id="reserve-form"
            key={reservingItem.id}
            onSubmit={(event) => void saveReservation(event)}
          >
            <Field
              help={`${reservingItem.totalUnits} pieces in ${reservingItem.warehouse} · ${availableUnits(asStockItem(reservingItem))} available right now.`}
              label="Pieces to reserve"
            >
              <input
                autoFocus
                defaultValue={reservingItem.reservedUnits || "0"}
                inputMode="numeric"
                max={reservingItem.totalUnits}
                min="0"
                name="reservedUnits"
                required
                type="number"
              />
            </Field>
          </form>
        )}
      </Modal>
    </AdminPage>
  );
}

/** "Top · Hoodie", or whichever half of it a record actually carries. */
function typeLabel(item: RecordRow) {
  return [item.category, item.itemType].filter(Boolean).join(" · ") || "—";
}

/** A register row read back as the shape the stock helpers expect. */
function asStockItem(row: RecordRow) {
  return { totalUnits: row.totalUnits ?? "0", reservedUnits: row.reservedUnits ?? "0" };
}
