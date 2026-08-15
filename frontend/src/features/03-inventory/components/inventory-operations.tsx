"use client";

import { ArrowLeftRight, Boxes, Check, MapPin, Truck, Warehouse } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Card, Meter, Section, Status } from "@/components/admin/admin-ui";
import { RecordManager, type Column, type FormField } from "@/components/admin/record-manager";
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";

export type InventoryOperationsView = "transfers" | "warehouses";

/* ---- transfers ----------------------------------------------------------- */

const TRANSFERS = [
  { id: "TRF-084", from: "BLR-01", to: "DEL-01", units: "48", dispatched: "05 Aug", status: "In transit" },
  { id: "TRF-083", from: "BLR-01", to: "MUM-01", units: "22", dispatched: "05 Aug", status: "Ready" },
  { id: "TRF-081", from: "DEL-01", to: "BLR-01", units: "6", dispatched: "03 Aug", status: "Received" },
];

const TRANSFER_COLUMNS: Column[] = [
  { key: "id", label: "Transfer", primary: true, sub: "dispatched" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "units", label: "Units", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

const TRANSFER_FIELDS: FormField[] = [
  { key: "id", label: "Transfer id", placeholder: "TRF-085", required: true },
  { key: "from", label: "Source", type: "select", options: ["BLR-01", "DEL-01", "MUM-01"] },
  { key: "to", label: "Destination", type: "select", options: ["DEL-01", "BLR-01", "MUM-01"] },
  { key: "units", label: "Units", type: "number", initial: "0", required: true },
  { key: "dispatched", label: "Dispatched", type: "date" },
  { key: "status", label: "State", type: "select", options: ["Ready", "In transit", "Received", "Cancelled"] },
];

/* ---- warehouses ---------------------------------------------------------- */

const WAREHOUSES = [
  { id: "BLR-01", name: "Bengaluru fulfilment centre", available: "1,248", capacity: "82", cutoff: "18:00 · Blue Dart", status: "Online" },
  { id: "DEL-01", name: "Delhi regional node", available: "486", capacity: "61", cutoff: "17:30 · Delhivery", status: "Online" },
  { id: "MUM-01", name: "Mumbai overflow", available: "112", capacity: "24", cutoff: "16:00 · Ecom Express", status: "Draft" },
];

const WAREHOUSE_COLUMNS: Column[] = [
  { key: "id", label: "Code", primary: true, sub: "name" },
  { key: "available", label: "Available", align: "right", numeric: true },
  { key: "capacity", label: "Capacity %", align: "right", numeric: true },
  { key: "cutoff", label: "Courier cut-off", hideSmall: true },
  { key: "status", label: "State", status: true },
];

const WAREHOUSE_FIELDS: FormField[] = [
  { key: "id", label: "Code", placeholder: "MUM-01", required: true },
  { key: "name", label: "Name", placeholder: "Mumbai overflow", full: true, required: true },
  { key: "available", label: "Available units", type: "number", initial: "0" },
  { key: "capacity", label: "Capacity used %", type: "number", initial: "0" },
  { key: "cutoff", label: "Courier cut-off", placeholder: "18:00 · Blue Dart" },
  { key: "status", label: "State", type: "select", options: ["Online", "Draft", "Disabled"] },
];

export function InventoryOperations({ view }: { view: InventoryOperationsView }) {
  if (view === "transfers") {
    const stats: Stat[] = [
      { label: "In transit", value: "01", icon: Truck, tone: "sky", note: "48 units to Delhi" },
      { label: "Ready to dispatch", value: "01", icon: ArrowLeftRight, tone: "amber", note: "22 units to Mumbai" },
      { label: "Received · 30d", value: "14", icon: Check, tone: "mint", note: "All reconciled" },
    ];

    return (
      <AdminPage
        eyebrow="Inventory · Transfers"
        icon={ArrowLeftRight}
        lede="Every handoff keeps its source, destination, quantities and scan evidence, and writes an immutable movement at both ends."
        spec={[
          { label: "Open", value: "02" },
          { label: "Units", value: "70" },
          { label: "Nodes", value: "03" },
        ]}
        title={
          <>
            Move with <em>custody</em>
          </>
        }
      >
        <StatGrid stats={stats} />
        <RecordManager
          columns={TRANSFER_COLUMNS}
          fields={TRANSFER_FIELDS}
          filterKey="status"
          filtersBelow
          icon={ArrowLeftRight}
          idPrefix="TRF"
          initial={TRANSFERS}
          singular="transfer"
          toolbarLead={<InventoryTabs />}
          tone="sky"
        />
      </AdminPage>
    );
  }

  const stats: Stat[] = [
    { label: "Online nodes", value: "02", icon: Warehouse, tone: "mint", note: "Bengaluru and Delhi" },
    { label: "Available units", value: "1,846", icon: Boxes, tone: "sky", note: "Across the network" },
    { label: "Capacity used", value: "72%", icon: MapPin, tone: "amber", note: "Weighted across nodes" },
  ];

  return (
    <AdminPage
      eyebrow="Inventory · Network"
      icon={Warehouse}
      lede="Capacity, courier cut-offs and stock health by location. Warehouse roles only ever see the nodes they are assigned to."
      spec={[
        { label: "Nodes", value: "03" },
        { label: "Online", value: "02" },
        { label: "Units", value: "1,846" },
      ]}
      title={
        <>
          Warehouse <em>network</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      {/* The register leads, so the area's tabs sit in the same place on all
          three inventory screens — in the toolbar, a row under the page head.
          Behind the cards they landed below the fold, which made the control
          you had just clicked appear to move. */}
      <Section copy="Add, edit or retire a node. Retiring one requires its stock to be zero." eyebrow="Manage" title="All locations">
        <RecordManager
          columns={WAREHOUSE_COLUMNS}
          fields={WAREHOUSE_FIELDS}
          filterKey="status"
          filtersBelow
          icon={Warehouse}
          idPrefix="WH"
          initial={WAREHOUSES}
          singular="warehouse"
          toolbarLead={<InventoryTabs />}
          tone="violet"
        />
      </Section>

      <div className="aui-grid">
        {WAREHOUSES.map((node) => (
          <Card
            copy={node.name}
            icon={Warehouse}
            key={node.id}
            kicker={`Courier cut-off ${node.cutoff}`}
            meta={[
              { label: "Available", value: node.available },
              { label: "Capacity", value: `${node.capacity}%` },
            ]}
            status={<Status value={node.status} />}
            title={node.id}
            tone={node.status === "Online" ? "mint" : "amber"}
          >
            <Meter label="Capacity used" value={Number(node.capacity)} />
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
