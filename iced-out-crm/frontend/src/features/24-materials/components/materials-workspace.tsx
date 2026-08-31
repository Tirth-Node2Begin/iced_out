"use client";

import { Layers, Scale, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPage, type StatusTone } from "@/components/shell/admin-ui";
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { AdjustStockDialog } from "@/features/24-materials/components/adjust-stock-dialog";
import { materials as api, useMaterials, useSuppliers } from "@/features/24-materials/materials-api";
import {
  KIND_LABELS,
  UNIT_LABELS,
  withUnit,
  type Material,
  type MaterialKind,
  type MaterialUnit,
} from "@/features/24-materials/types";
import { useRegisterList } from "@/api/use-register";

/**
 * The material register — everything the shop buys IN, before a garment exists.
 *
 * `stock_items` counts finished pieces; this counts what they are made of. The
 * two meet on the production screen, which is where a run turns metres into
 * hoodies.
 *
 * THE COLUMN THAT MATTERS IS `available`, not `onHand`. A roll that is on the
 * shelf but promised to a started run cannot be cut into anything else, and a
 * register that showed only the shelf count would send an operator to fetch
 * fabric that is already spoken for.
 */
function toRow(material: Material): RecordRow {
  return {
    id: material.id,
    code: material.code,
    name: material.name,
    kind: KIND_LABELS[material.kind] ?? material.kind,
    kindCode: material.kind,
    unit: UNIT_LABELS[material.unit] ?? material.unit,
    unitCode: material.unit,
    onHand: material.onHand,
    reserved: material.reserved,
    available: withUnit(material.available, material.unit),
    availableRaw: material.available,
    reorderPoint: material.reorderPoint,
    unitCost: material.unitCost,
    unitCostRaw: String(material.unitCostRaw),
    stockValue: material.stockValue,
    supplier: material.supplier?.name ?? "",
    supplierId: material.supplier?.id ?? "",
    warehouseId: material.warehouse?.id ?? "",
    status: material.state,
    statusCode: material.status,
    usedIn: String(material.usedIn),
    notes: material.notes,
  };
}

const STATE_ORDER = ["Out", "At risk", "Healthy"];

/* Out is worse than at-risk, and both are worse than fine. The tone says which
   of the three you are looking at without reading the word. */
const STATE_TONES: Record<string, StatusTone> = {
  Out: "bad",
  "At risk": "warn",
  Healthy: "good",
};

export function MaterialsWorkspace() {
  const { materials: rows, summary, loading, error, loaded, reload } = useMaterials();
  const { suppliers } = useSuppliers({ status: "ACTIVE" });
  /* Warehouses are their own register rather than part of the stock context —
     the same list the stock and transfer screens read. */
  const { rows: warehouses } = useRegisterList("/admin/inventory/warehouses");
  const [adjusting, setAdjusting] = useState<Material | null>(null);

  const tableRows = useMemo(() => rows.map(toRow), [rows]);
  const after = useCallback(async () => {
    await reload();
  }, [reload]);

  const fields: FormField[] = useMemo(
    () => [
      { key: "name", label: "Material", required: true, full: true, placeholder: "520 GSM brushed fleece" },
      { key: "code", label: "Your code", placeholder: "FLC-520-BLK", hint: "optional" },
      {
        key: "kindCode",
        label: "Kind",
        type: "select",
        options: (Object.keys(KIND_LABELS) as MaterialKind[]).map((value) => ({
          value,
          label: KIND_LABELS[value],
        })),
        initial: "FABRIC",
      },
      {
        key: "unitCode",
        label: "Measured in",
        type: "select",
        options: (Object.keys(UNIT_LABELS) as MaterialUnit[]).map((value) => ({
          value,
          label: UNIT_LABELS[value],
        })),
        initial: "M",
        /* Changing this after stock exists would reinterpret every number in
           the ledger — 100 metres becoming 100 kilograms. The API allows it
           because a mistake made on day one has to be fixable; the help text is
           what stops it being made on day two hundred. */
        help: "Change this only while the material is empty — every quantity already recorded is in the old unit.",
      },
      {
        key: "reorderPoint",
        label: "Warn below",
        type: "number",
        min: "0",
        step: "0.001",
        help: "Free stock at or under this reads as At risk. Leave at 0 to never warn — right for a consumable you always have.",
      },
      { key: "unitCostRaw", label: "Cost per unit", hint: "₹", type: "number", min: "0", step: "0.01" },
      {
        key: "supplierId",
        label: "Bought from",
        type: "select",
        options: [
          { value: "none", label: "Not recorded" },
          ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
        ],
        initial: "none",
      },
      {
        key: "warehouseId",
        label: "Held at",
        type: "select",
        options: [
          { value: "none", label: "Not recorded" },
          ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
        ],
        initial: "none",
      },
      { key: "notes", label: "Notes", type: "textarea", full: true },
    ],
    [suppliers, warehouses],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Material", primary: true, sub: "code" },
      { key: "kind", label: "Kind", hideSmall: true },
      { key: "available", label: "Free", numeric: true, align: "right" },
      { key: "reserved", label: "Held", numeric: true, align: "right", hideSmall: true },
      { key: "unitCost", label: "Cost", numeric: true, align: "right", hideSmall: true },
      { key: "stockValue", label: "Value", numeric: true, align: "right", hideSmall: true },
      { key: "supplier", label: "Supplier", hideSmall: true },
      { key: "status", label: "Stock", status: true },
    ],
    [],
  );

  return (
    <AdminPage
      eyebrow="Inventory"
      icon={Layers}
      lede="Everything the shop buys in. A run turns these into finished pieces — what is Held has already been promised to one."
      spec={[
        { label: "Materials", value: String(summary.total) },
        { label: "At risk", value: String(summary.atRisk) },
        { label: "Out", value: String(summary.outOfStock) },
        { label: "Stock value", value: summary.stockValue },
      ]}
      title={
        <>
          Raw <em>materials</em>
        </>
      }
    >
      <RecordManager
        columns={columns}
        emptyHint="Add what a garment is made of — fabric, thread, zips, labels. Stock arrives through a purchase, so a new material starts empty on purpose."
        error={error}
        fields={fields}
        filterKey="status"
        filterOrder={STATE_ORDER}
        filterValues={STATE_ORDER}
        icon={Layers}
        loaded={loaded}
        loading={loading}
        onCreate={async (values) => {
          await api.create({
            name: values.name,
            code: values.code,
            kind: values.kindCode,
            unit: values.unitCode,
            reorderPoint: Number(values.reorderPoint ?? 0) || 0,
            unitCost: Number(values.unitCostRaw ?? 0) || 0,
            supplier: values.supplierId,
            warehouse: values.warehouseId,
            notes: values.notes,
          });
          await after();
        }}
        onDelete={async (row) => {
          await api.remove(row.id);
          await after();
        }}
        onUpdate={async (values, previous) => {
          await api.update(previous.id, {
            name: values.name,
            code: values.code,
            kind: values.kindCode,
            unit: values.unitCode,
            reorderPoint: Number(values.reorderPoint ?? 0) || 0,
            unitCost: Number(values.unitCostRaw ?? 0) || 0,
            supplier: values.supplierId || "none",
            warehouse: values.warehouseId || "none",
            notes: values.notes,
          });
          await after();
        }}
        plural="materials"
        rowAction={(row) => [
          {
            icon: Scale,
            label: "Correct the count",
            onSelect: () => {
              const material = rows.find((candidate) => candidate.id === row.id);
              if (material) setAdjusting(material);
            },
          },
        ]}
        rowHref={(row) => `/inventory/materials/detail?id=${encodeURIComponent(row.id)}`}
        rows={tableRows}
        searchKeys={["id", "name", "code", "supplier", "kind"]}
        singular="Material"
        statusTone={(row) => STATE_TONES[row.status]}
        toolbarLead={<InventoryTabs />}
      >
        {/* The one thing a register cannot say in a column: a count here is
            never edited directly. Stock arrives on a purchase and leaves on a
            run, and anything else is an adjustment with a reason attached. */}
        <p className="aui-muted mat-note">
          <Trash2 aria-hidden size={13} strokeWidth={1.7} />
          Quantities are not edited here. Stock arrives on a purchase, leaves on a production run, and
          anything else is a correction with a reason recorded against it.
        </p>
      </RecordManager>

      {adjusting && (
        <AdjustStockDialog
          material={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={async () => {
            setAdjusting(null);
            await after();
            toast.success("The count was corrected.");
          }}
        />
      )}
    </AdminPage>
  );
}
