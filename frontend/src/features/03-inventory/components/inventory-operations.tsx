"use client";

import { ArrowLeftRight, Boxes, Check, MapPin, Truck, Warehouse } from "lucide-react";
import { useMemo } from "react";

import { useRegister } from "@/api/use-register";
import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Card, Meter, Section, Status } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/admin/record-manager";
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";

export type InventoryOperationsView = "transfers" | "warehouses";

/**
 * Transfers and the warehouse network, read from the database.
 *
 * Both screens held their rows as arrays in this file, and every figure above
 * them was a matching string: "In transit 01 · 48 units to Delhi", "Available
 * units 1,846", "Capacity used 72%". They described the three seeded warehouses
 * and the three seeded transfers, and they went on describing them after an
 * operator added a fourth node or moved stock — because none of it was counted
 * from anything.
 *
 * Every number below is now derived from the rows the API returned, so a card can
 * never disagree with the table under it.
 */

/** Two digits, so a row of counts does not jump about as they change. */
const pad = (value: number) => String(value).padStart(2, "0");

const countOf = (value: number) => value.toLocaleString("en-IN");

/* ---- transfers ----------------------------------------------------------- */

/**
 * The states a transfer moves through, and the order the filter chips sit in.
 *
 * These match what `POST /admin/inventory/transfers/{id}/transition` accepts.
 * `Ready` is where one starts — the endpoint does not accept it, because a
 * transfer cannot be moved back to not having left.
 */
const TRANSFER_STATES = ["Ready", "In transit", "Received", "Cancelled"];

const TRANSFER_COLUMNS: Column[] = [
  { key: "id", label: "Transfer", primary: true, sub: "dispatched" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "units", label: "Units", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

/* ---- warehouses ---------------------------------------------------------- */

const WAREHOUSE_STATES = ["Online", "Draft", "Disabled"];

const WAREHOUSE_COLUMNS: Column[] = [
  { key: "id", label: "Code", primary: true, sub: "name" },
  { key: "available", label: "Available", align: "right", numeric: true },
  { key: "capacity", label: "Capacity %", align: "right", numeric: true },
  { key: "cutoff", label: "Courier cut-off", hideSmall: true },
  { key: "status", label: "State", status: true },
];

/**
 * What a node is asked for.
 *
 * The code is typed — it is the operator's own name for a place, and it is what
 * stock and transfers reference. `available` is NOT a field: it is the sum of what
 * the node actually holds, which the server counts (`InventoryPresenter`). It used
 * to be an editable number, so a warehouse could claim 1,846 units while holding
 * none.
 */
const WAREHOUSE_FIELDS: FormField[] = [
  { key: "id", label: "Code", placeholder: "MUM-01", required: true },
  { key: "name", label: "Name", placeholder: "Mumbai overflow", full: true, required: true },
  { key: "capacity", label: "Capacity used %", type: "number", initial: "0", min: "0" },
  { key: "cutoff", label: "Courier cut-off", placeholder: "18:00 · Blue Dart" },
  { key: "status", label: "State", type: "select", options: WAREHOUSE_STATES },
];

export function InventoryOperations({ view }: { view: InventoryOperationsView }) {
  /* Both registers are read on both screens: the transfer form's source and
     destination are the warehouse list, so a node added on the network screen can
     be moved to from the transfers screen without a reload. */
  const warehouses = useRegister(
    useMemo(
      () => ({
        path: "/admin/inventory/warehouses",
        itemPath: (row: RecordRow) => `/admin/inventory/warehouses/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          id: values.id,
          name: values.name,
          capacity: Number(values.capacity ?? 0) || 0,
          cutoff: values.cutoff ?? "",
          status: values.status ?? "Draft",
        }),
        /* The code is the node's identity and what every stock row points at, so
           it is not in the update body — renaming a place is fine, re-coding it
           would orphan its stock. */
        toUpdate: (values: RecordRow) => ({
          name: values.name,
          capacity: Number(values.capacity ?? 0) || 0,
          cutoff: values.cutoff ?? "",
          status: values.status ?? "Draft",
        }),
      }),
      [],
    ),
  );

  const transfers = useRegister(
    useMemo(
      () => ({
        path: "/admin/inventory/transfers",
        toCreate: (values: RecordRow) => ({
          from: values.from,
          to: values.to,
          units: Number(values.units ?? 0) || 0,
          dispatched: values.dispatched,
        }),
      }),
      [],
    ),
  );

  const codes = useMemo(
    () => warehouses.rows.map((row) => row.id).filter(Boolean),
    [warehouses.rows],
  );

  if (view === "transfers") {
    return (
      <TransfersScreen codes={codes} transfers={transfers} warehouseError={warehouses.error} />
    );
  }

  return <NetworkScreen warehouses={warehouses} />;
}

/* ================================================================ transfers */

function TransfersScreen({
  codes,
  transfers,
  warehouseError,
}: {
  codes: string[];
  transfers: ReturnType<typeof useRegister>;
  warehouseError: string | null;
}) {
  const rows = transfers.rows;

  const unitsIn = (state: string) =>
    rows
      .filter((row) => row.status === state)
      .reduce((sum, row) => sum + (Number(row.units) || 0), 0);

  const inTransit = rows.filter((row) => row.status === "In transit");
  const ready = rows.filter((row) => row.status === "Ready");
  const received = rows.filter((row) => row.status === "Received");
  const open = inTransit.length + ready.length;

  /* Counted off the rows on screen. Where a note used to name a destination
     ("48 units to Delhi") it now names the total, because with more than one
     transfer in a state there is no single destination to name. */
  const stats: Stat[] = [
    {
      label: "In transit",
      value: pad(inTransit.length),
      icon: Truck,
      tone: "sky",
      note: inTransit.length ? `${countOf(unitsIn("In transit"))} units moving` : "Nothing moving",
    },
    {
      label: "Ready to dispatch",
      value: pad(ready.length),
      icon: ArrowLeftRight,
      tone: ready.length ? "amber" : "mint",
      note: ready.length ? `${countOf(unitsIn("Ready"))} units waiting` : "Nothing waiting",
    },
    {
      label: "Received",
      value: pad(received.length),
      icon: Check,
      tone: "mint",
      note: received.length ? `${countOf(unitsIn("Received"))} units reconciled` : "None yet",
    },
  ];

  /* The form asks where from, where to, how many and when — never the id, which
     the server mints, and never the state, which a new transfer is always Ready
     in. The two node lists are the warehouse register. */
  const fields: FormField[] = [
    { key: "from", label: "Source", type: "select", options: codes, required: true },
    {
      key: "to",
      label: "Destination",
      type: "select",
      /* Never the source: a transfer to the place it is already in is not one. */
      optionsFor: (values) => codes.filter((code) => code !== values.from),
      required: true,
    },
    { key: "units", label: "Units", type: "number", initial: "0", min: "1", required: true },
    { key: "dispatched", label: "Dispatched", type: "date", required: true },
  ];

  return (
    <AdminPage
      eyebrow="Inventory · Transfers"
      icon={ArrowLeftRight}
      lede="Every handoff keeps its source, destination, quantities and scan evidence, and writes an immutable movement at both ends."
      spec={[
        { label: "Open", value: pad(open) },
        { label: "Units", value: countOf(rows.reduce((sum, row) => sum + (Number(row.units) || 0), 0)) },
        { label: "Nodes", value: pad(codes.length) },
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
        emptyHint={
          codes.length === 0
            ? "There are no warehouses to move stock between yet. Add one on the Network tab."
            : "No transfers yet. Start one to move stock between two nodes."
        }
        error={transfers.error ?? warehouseError}
        fields={fields}
        filterKey="status"
        filtersBelow
        filterValues={TRANSFER_STATES}
        icon={ArrowLeftRight}
        loaded={transfers.loaded}
        loading={transfers.loading}
        onCreate={transfers.onCreate}
        /* No edit and no delete: a transfer is a movement that happened, and the
           API offers neither. It is moved along instead, by the verb on its row. */
        rows={rows}
        singular="transfer"
        toolbarLead={<InventoryTabs />}
        tone="sky"
        rowAction={(row) => {
          const next = NEXT_TRANSFER_STEP[row.status];
          if (!next) return null;

          return next.map((step) => ({
            icon: step.to === "Received" ? Check : step.to === "Cancelled" ? ArrowLeftRight : Truck,
            tone: step.to === "Cancelled" ? ("danger" as const) : ("good" as const),
            label: `${step.verb} · ${row.id}`,
            /* Its own endpoint: receiving a transfer writes the movement at the
               destination as well as changing the word on this row. */
            onSelect: () =>
              transfers.act(
                `/admin/inventory/transfers/${encodeURIComponent(row.id)}/transition`,
                { status: step.to },
              ),
            toast: { title: step.title, description: `${row.id} · ${row.units} units.` },
          }));
        }}
      />
    </AdminPage>
  );
}

/**
 * Where a transfer can go next.
 *
 * `Ready → In transit | Cancelled`, `In transit → Received | Cancelled`, and a
 * received or cancelled transfer is history. Mirrors what the transition endpoint
 * accepts, so a row never offers a move the server would refuse.
 */
const NEXT_TRANSFER_STEP: Record<string, Array<{ to: string; verb: string; title: string }>> = {
  Ready: [
    { to: "In transit", verb: "Send", title: "Transfer sent" },
    { to: "Cancelled", verb: "Cancel", title: "Transfer cancelled" },
  ],
  "In transit": [
    { to: "Received", verb: "Mark received", title: "Transfer received" },
    { to: "Cancelled", verb: "Cancel", title: "Transfer cancelled" },
  ],
};

/* =============================================================== the network */

function NetworkScreen({ warehouses }: { warehouses: ReturnType<typeof useRegister> }) {
  const rows = warehouses.rows;

  const online = rows.filter((row) => row.status === "Online");

  /* `available` is a formatted count from the server ("1,248"), so the commas come
     off before it is added up. */
  const unitsOf = (row: RecordRow) => Number((row.available ?? "").replace(/[^\d]/g, "")) || 0;
  const units = rows.reduce((sum, row) => sum + unitsOf(row), 0);

  /**
   * Capacity across the network, weighted by what each node holds.
   *
   * A plain average would let an empty overflow node at 2% drag the figure down
   * as far as the main warehouse at 90% pulls it up, which is not what "capacity
   * used" means to anyone reading it. A node holding nothing contributes nothing.
   */
  const weighted = units
    ? Math.round(
        rows.reduce((sum, row) => sum + (Number(row.capacity) || 0) * unitsOf(row), 0) / units,
      )
    : 0;

  const stats: Stat[] = [
    {
      label: "Online nodes",
      value: pad(online.length),
      icon: Warehouse,
      tone: online.length ? "mint" : "amber",
      note: online.length
        ? online.map((row) => row.id).join(", ")
        : "Nothing is taking stock yet",
    },
    {
      label: "Available units",
      value: countOf(units),
      icon: Boxes,
      tone: "sky",
      note: "Across the network",
    },
    {
      label: "Capacity used",
      value: `${weighted}%`,
      icon: MapPin,
      tone: weighted >= 80 ? "rose" : weighted >= 60 ? "amber" : "mint",
      note: "Weighted by units held",
    },
  ];

  return (
    <AdminPage
      eyebrow="Inventory · Network"
      icon={Warehouse}
      lede="Capacity, courier cut-offs and stock health by location. Warehouse roles only ever see the nodes they are assigned to."
      spec={[
        { label: "Nodes", value: pad(rows.length) },
        { label: "Online", value: pad(online.length) },
        { label: "Units", value: countOf(units) },
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
          emptyHint="No warehouses yet. Add the first one before taking stock in."
          error={warehouses.error}
          fields={WAREHOUSE_FIELDS}
          filterKey="status"
          filtersBelow
          filterValues={WAREHOUSE_STATES}
          icon={Warehouse}
          loaded={warehouses.loaded}
          loading={warehouses.loading}
          onCreate={warehouses.onCreate}
          onUpdate={warehouses.onUpdate}
          /* No delete: the API offers none, because a node with stock in it or
             transfers pointing at it cannot simply vanish. Retiring it is the
             `Disabled` state. */
          rows={rows}
          singular="warehouse"
          toolbarLead={<InventoryTabs />}
          tone="violet"
        />
      </Section>

      {rows.length > 0 && (
        <div className="aui-grid">
          {rows.map((node) => (
            <Card
              copy={node.name}
              icon={Warehouse}
              key={node.id}
              kicker={node.cutoff ? `Courier cut-off ${node.cutoff}` : "No cut-off set"}
              meta={[
                { label: "Available", value: node.available || "0" },
                { label: "Capacity", value: `${Number(node.capacity) || 0}%` },
              ]}
              status={<Status value={node.status} />}
              title={node.id}
              tone={node.status === "Online" ? "mint" : "amber"}
            >
              <Meter label="Capacity used" value={Number(node.capacity) || 0} />
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
