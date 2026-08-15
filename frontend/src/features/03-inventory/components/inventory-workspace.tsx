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
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";
import {
  availableUnits,
  CATEGORIES,
  SIZES_BY_CATEGORY,
  TYPES_BY_CATEGORY,
  WAREHOUSE_CODES,
} from "@/features/03-inventory/data/stock-fixtures";
import { useStock } from "@/features/03-inventory/stock-context";

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
  { key: "itemName", label: "Item", primary: true, sub: "sizes" },
  {
    key: "itemType",
    label: "Type",
    hideSmall: true,
    render: (item) => typeLabel(item),
    exportValue: (item) => typeLabel(item),
  },
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
  { key: "category", label: "Category", type: "select", options: CATEGORIES, help: "Sets the sizes below." },
  { key: "itemType", label: "Type", type: "select", optionsFor: (item) => TYPES_BY_CATEGORY[item.category] ?? [] },
  { key: "sizes", label: "Sizes", type: "chips", optionsFor: (item) => SIZES_BY_CATEGORY[item.category] ?? [], required: true, full: true, help: "Pick every size this item is stocked in." },
  { key: "warehouse", label: "Warehouse", type: "select", options: WAREHOUSE_CODES },
  { key: "totalUnits", label: "Total pieces", type: "number", initial: "0", required: true, help: "How many pieces are physically in that warehouse." },
];

export function InventoryWorkspace() {
  /* Held in a store rather than on this screen: the catalogue lists what is in
     here, so stock has to outlive the tab it was typed into. */
  const { items, commit } = useStock();
  /** The item whose reservation is being set, or nothing if the dialog is shut. */
  const [reservingItem, setReservingItem] = useState<RecordRow | undefined>(undefined);

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

  /** Saves a new reservation for the item the dialog was opened on. */
  function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservingItem) return;

    const typed = Number(new FormData(event.currentTarget).get("reservedUnits") ?? 0);
    /* Clamped rather than rejected: the input already says what the ceiling is,
       and refusing the form over a typo is worse than holding it at the ceiling. */
    const reserved = Math.min(Math.max(0, Math.round(typed)), Number(reservingItem.totalUnits || 0));

    commit((current) =>
      current.map((item) =>
        item.id === reservingItem.id ? { ...item, reservedUnits: String(reserved) } : item,
      ),
    );

    toast.success(`${reservingItem.itemName} · ${reserved} reserved`, {
      description: `${Number(reservingItem.totalUnits || 0) - reserved} pieces left to sell.`,
    });
    setReservingItem(undefined);
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
        /* The item form never asks about reservations, so a new item starts at
           zero reserved and an edited one keeps whatever it was already
           holding — editing a name must not quietly release stock. */
        derive={(values, _rows, previous) => ({
          ...values,
          reservedUnits: previous?.reservedUnits ?? "0",
        })}
        emptyHint="Add your first item — a name, its sizes, a warehouse and how many pieces are there."
        fields={FIELDS}
        filterKey="warehouse"
        filtersBelow
        filterValues={WAREHOUSE_CODES}
        icon={Boxes}
        idPrefix="ITM"
        onCommit={commit}
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
            <Btn onClick={() => setReservingItem(undefined)}>Cancel</Btn>
            <Btn form="reserve-form" type="submit" variant="solid">
              Save reservation
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
            onSubmit={saveReservation}
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
