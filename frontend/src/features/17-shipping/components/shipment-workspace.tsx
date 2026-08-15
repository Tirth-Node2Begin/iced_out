"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RotateCcw,
  Route,
  Truck,
  Undo2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Btn, Field, Modal, Note, Select } from "@/components/admin/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
  type RowAction,
} from "@/components/admin/record-manager";
import { awaitingDispatch, useFulfilment } from "@/features/07-orders/fulfilment-context";
import { COURIERS, SHIPMENT_STATES } from "@/features/17-shipping/data/shipment-fixtures";

export type ShipmentView = "active" | "failed" | "pickups";

/**
 * Shipments live as one register per view, with the courier and the promise
 * as columns rather than as a decorated card — a dispatcher reads down a
 * column of promises, not across twenty cards.
 *
 * A shipment starts when an order is DISPATCHED, which is why the active view
 * opens by offering the confirmed orders that nothing is carrying yet: pick
 * the courier and the day it goes out, and the parcel exists from then on.
 */

const SHIPMENT_COLUMNS: Column[] = [
  { key: "id", label: "Shipment", primary: true, sub: "awb" },
  { key: "order", label: "Order" },
  { key: "provider", label: "Courier", hideSmall: true },
  { key: "destination", label: "Destination", hideSmall: true },
  { key: "dispatched", label: "Dispatched", align: "right", hideSmall: true },
  { key: "status", label: "State", status: true },
];

const SHIPMENT_FIELDS: FormField[] = [
  { key: "order", label: "Order", placeholder: "IO-2026-1049", required: true },
  { key: "provider", label: "Courier", type: "select", options: [...COURIERS] },
  { key: "awb", label: "AWB", placeholder: "••••1049" },
  { key: "destination", label: "Destination", placeholder: "Bengaluru" },
  { key: "dispatched", label: "Dispatched on", type: "date" },
  { key: "status", label: "State", type: "select", options: [...SHIPMENT_STATES] },
];

/**
 * What a parcel's row offers next, and the way out of that step.
 *
 * The way out is not the same at both ends of the journey. A parcel that has
 * been dispatched but has not moved yet can only be CALLED OFF — nothing has
 * been attempted, so there is no delivery to have failed. Only once it is out
 * with the courier can it come back undelivered, which is what `Failed` means
 * and why it is offered nowhere else.
 *
 * A parcel that has arrived, failed, or been cancelled has nothing left to be
 * moved to from here.
 */
type ShipmentStep = {
  to: string;
  verb: string;
  said: string;
  exit: { to: string; verb: string; title: string; said: string };
};

const NEXT_SHIPMENT_STEP: Record<string, ShipmentStep> = {
  Dispatched: {
    to: "In transit",
    verb: "Mark in transit",
    said: "is with the courier",
    exit: {
      to: "Cancelled",
      verb: "Cancel",
      title: "Shipment cancelled",
      said: "was called off before it moved",
    },
  },
  "In transit": {
    to: "Delivered",
    verb: "Mark delivered",
    said: "was delivered",
    exit: {
      to: "Failed",
      verb: "Mark failed",
      title: "Delivery failed",
      said: "came back undelivered",
    },
  },
};

export function ShipmentWorkspace({ view = "active" }: { view?: ShipmentView }) {
  if (view === "failed") return <FailedDeliveries />;
  if (view === "pickups") return <CourierPickups />;
  return <ActiveShipments />;
}

/* ============================================== failed deliveries */

/**
 * Parcels the courier could not hand over.
 *
 * Nothing arrives here by hand: this screen is the SAME register as the active
 * one, read through a single question — is the parcel failed? Marking a
 * shipment failed on the active screen writes to the store both screens share,
 * so the row appears here in the same breath, with no copy of it to keep in
 * step.
 *
 * A failed parcel has exactly two ways out, so this screen keeps exactly two
 * words for where one has got to. `handling` is the screen's own field; a
 * parcel nobody has looked at yet has none, which reads as "Needs action".
 */
const NEEDS_ACTION = "Needs action";
const SENDING_BACK = "Sending back";

/** Why a courier came back with the parcel, in the words a person would use. */
const FAILURE_REASONS = [
  "Nobody was home",
  "Address was wrong",
  "Customer said no",
  "Could not reach the customer",
  "Not shared yet",
];

const FAILED_COLUMNS: Column[] = [
  { key: "id", label: "Parcel", primary: true, sub: "order" },
  { key: "reason", label: "What went wrong" },
  { key: "provider", label: "Courier", hideSmall: true },
  { key: "destination", label: "Going to", hideSmall: true },
  { key: "handling", label: "Status", status: true },
];

const FAILED_FIELDS: FormField[] = [
  { key: "order", label: "Order", placeholder: "IO-2026-1049", required: true },
  { key: "provider", label: "Courier", type: "select", options: [...COURIERS] },
  { key: "destination", label: "Going to", placeholder: "Bengaluru" },
  { key: "reason", label: "What went wrong", type: "select", options: FAILURE_REASONS, full: true },
];

function FailedDeliveries() {
  const { shipments, commitShipments } = useFulfilment();

  /* The two blanks a parcel arrives with — it was marked failed on the active
     screen, which asks for neither — are filled in for reading only. Nothing
     is written back until the operator picks one of the two verbs below. */
  const failed = shipments
    .filter((row) => row.status === "Failed")
    .map((row) => ({
      ...row,
      reason: row.reason || "Not shared yet",
      handling: row.handling || NEEDS_ACTION,
    }));

  const waiting = failed.filter((row) => row.handling === NEEDS_ACTION).length;
  const returning = failed.length - waiting;
  const pad = (value: number) => String(value).padStart(2, "0");

  const stats: Stat[] = [
    {
      label: "Failed parcels",
      value: pad(failed.length),
      icon: AlertTriangle,
      tone: "rose",
      note: "Came straight from active shipments",
    },
    {
      label: "Needs action",
      value: pad(waiting),
      icon: Clock3,
      tone: "amber",
      note: waiting ? "Waiting for you to decide" : "Nothing waiting on you",
    },
    {
      label: "Coming back",
      value: pad(returning),
      icon: Undo2,
      tone: "sky",
      note: "On the way back to the store",
    },
  ];

  return (
    <AdminPage
      eyebrow="Shipping · Failed deliveries"
      icon={AlertTriangle}
      lede="Parcels the courier could not hand over. Each one has two ways out — send it out again, or bring it back to the store."
      spec={[
        { label: "Failed", value: pad(failed.length) },
        { label: "Needs action", value: pad(waiting) },
        { label: "Coming back", value: pad(returning) },
      ]}
      title={
        <>
          Failed <em>deliveries</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      {waiting > 0 && (
        <Note
          icon={AlertTriangle}
          title={`${waiting} ${waiting === 1 ? "parcel needs" : "parcels need"} a decision`}
          tone="warn"
        >
          Parcels land here on their own — anything marked failed on active shipments shows up in
          this list. Send it out again and it goes back to the courier; send it back and it returns
          to the store.
        </Note>
      )}

      <RecordManager
        columns={FAILED_COLUMNS}
        emptyHint="Nothing has failed. If a parcel is marked failed on active shipments, it appears here by itself."
        fields={FAILED_FIELDS}
        filterKey="handling"
        filterValues={[NEEDS_ACTION, SENDING_BACK]}
        icon={AlertTriangle}
        idPrefix="shp"
        onCommit={commitShipments}
        rows={failed}
        searchKeys={["id", "order", "reason", "provider", "destination", "handling"]}
        singular="failed delivery"
        plural="failed deliveries"
        tone="rose"
        statusTone={(row) => (row.handling === SENDING_BACK ? "info" : "warn")}
        /* A row typed in here is still a parcel in the one register, so it is
           created already failed and already waiting on a decision. On an edit
           `previous` carries what the row is doing now, and that is kept. */
        derive={(values, _rows, previous) => ({
          ...values,
          status: "Failed",
          handling: previous?.handling || NEEDS_ACTION,
          awb: previous?.awb ?? `••••${values.order.slice(-4)}`,
        })}
        rowAction={(row) => {
          if (row.handling === SENDING_BACK) {
            return {
              icon: PackageCheck,
              tone: "good" as const,
              label: `${row.id} is back in the store`,
              patch: { status: "Cancelled", handling: "Back in store" },
              toast: {
                title: "Parcel is back",
                description: `${row.id} reached the store and is closed.`,
              },
            };
          }

          const choices: RowAction[] = [
            {
              icon: RotateCcw,
              tone: "good" as const,
              label: `Send ${row.id} out again`,
              patch: { status: "In transit", handling: "" },
              toast: {
                title: "Out for delivery again",
                description: `${row.id} is back with ${row.provider}.`,
              },
            },
            {
              icon: Undo2,
              tone: "danger" as const,
              label: `Send ${row.id} back to the store`,
              patch: { handling: SENDING_BACK },
              toast: {
                title: "Coming back",
                description: `${row.id} is on its way back to the store.`,
              },
            },
          ];

          return choices;
        }}
      />
    </AdminPage>
  );
}

/* ================================================= courier pickups */

/**
 * One batch of parcels going out with one courier.
 *
 * It used to be called a manifest and carried a hand-typed id and a state
 * field that could be set to anything. Both are gone: a batch is open while
 * you are still adding parcels to it, and handed over once the driver has
 * taken them. Two words, and only one move between them.
 */
const PICKUP_OPEN = "Open";
const PICKUP_DONE = "Handed over";

const PICKUPS: RecordRow[] = [
  { id: "PICK-0412", provider: "Blue Dart", parcels: "18", pickup: "05 Aug · 17:30", status: PICKUP_OPEN },
  { id: "PICK-0411", provider: "Delhivery", parcels: "09", pickup: "05 Aug · 16:00", status: PICKUP_DONE },
  { id: "PICK-0410", provider: "Ecom Express", parcels: "04", pickup: "04 Aug · 17:00", status: PICKUP_DONE },
];

const PICKUP_COLUMNS: Column[] = [
  { key: "id", label: "Pickup", primary: true, sub: "provider" },
  { key: "parcels", label: "Parcels", align: "right", numeric: true },
  { key: "pickup", label: "When", hideSmall: true },
  { key: "status", label: "Status", status: true },
];

const PICKUP_FIELDS: FormField[] = [
  { key: "provider", label: "Courier", type: "select", options: [...COURIERS], required: true },
  { key: "parcels", label: "Parcels", type: "number", initial: "0", required: true },
  { key: "pickup", label: "When", placeholder: "06 Aug · 17:30", full: true },
];

function CourierPickups() {
  /* The register keeps the rows; this copy exists only so the head can count
     them, and is fed by the same change that updates the table. */
  const [rows, setRows] = useState<RecordRow[]>(PICKUPS);

  const open = rows.filter((row) => row.status === PICKUP_OPEN);
  const parcels = open.reduce((total, row) => total + (Number(row.parcels) || 0), 0);

  return (
    <AdminPage
      eyebrow="Shipping · Courier pickup"
      icon={PackageCheck}
      lede="A pickup is one batch of parcels going out with one courier. Keep it open while you add parcels, then hand it over when the driver takes them."
      spec={[
        { label: "Open", value: String(open.length).padStart(2, "0") },
        { label: "Parcels waiting", value: String(parcels).padStart(2, "0") },
      ]}
      title={
        <>
          Courier <em>pickups</em>
        </>
      }
    >
      <RecordManager
        columns={PICKUP_COLUMNS}
        emptyHint="No pickups yet. Start one for the courier collecting today, then hand it over when the driver arrives."
        fields={PICKUP_FIELDS}
        filterKey="status"
        filterValues={[PICKUP_OPEN, PICKUP_DONE]}
        icon={PackageCheck}
        idPrefix="PICK"
        initial={PICKUPS}
        onRowsChange={setRows}
        singular="pickup"
        tone="violet"
        statusTone={(row) => (row.status === PICKUP_DONE ? "good" : "warn")}
        /* The form does not ask for a state — a new batch is open, and an edit
           leaves whatever the batch is already doing alone. */
        derive={(values, _rows, previous) => ({
          ...values,
          status: previous?.status ?? PICKUP_OPEN,
        })}
        rowAction={(row) =>
          row.status === PICKUP_OPEN
            ? {
                icon: Truck,
                tone: "good" as const,
                label: `Hand ${row.id} to ${row.provider}`,
                patch: { status: PICKUP_DONE },
                toast: {
                  title: "Handed over",
                  description: `${row.parcels} parcels went with ${row.provider}.`,
                },
              }
            : null
        }
      />
    </AdminPage>
  );
}

/* ================================================= the active register */

/** Today, as the date input wants it. */
function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-08-06` as an operator reads it. */
function readableDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(day).padStart(2, "0")} ${months[month - 1]}`;
}

function ActiveShipments() {
  const { orders, shipments, commitShipments, dispatchOrder } = useFulfilment();
  const [dispatching, setDispatching] = useState(false);

  const waiting = awaitingDispatch(orders, shipments);
  const count = (state: string) => shipments.filter((row) => row.status === state).length;

  const stats: Stat[] = [
    {
      label: "To dispatch",
      value: String(waiting.length).padStart(2, "0"),
      icon: PackageCheck,
      tone: "amber",
      note: waiting.length ? "Confirmed, nothing carrying them" : "Everything confirmed is out",
    },
    {
      label: "In transit",
      value: String(count("Dispatched") + count("In transit")).padStart(2, "0"),
      icon: Truck,
      tone: "sky",
      note: "Dispatched and on the way",
    },
    {
      label: "Delivered",
      value: String(count("Delivered")).padStart(2, "0"),
      icon: CheckCircle2,
      tone: "mint",
      note: "Signed for",
    },
    {
      label: "Failed",
      value: String(count("Failed")).padStart(2, "0"),
      icon: AlertTriangle,
      tone: "rose",
      note: "Needs a second attempt",
    },
  ];

  function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderId = String(form.get("order") ?? "");
    const provider = String(form.get("provider") ?? COURIERS[0]);
    const date = String(form.get("dispatched") ?? "") || todayValue();

    if (!orderId) return;

    dispatchOrder({ orderId, provider, dispatched: readableDate(date) });
    setDispatching(false);
    toast.success("Order dispatched", {
      description: `${orderId} left with ${provider} on ${readableDate(date)}.`,
    });
  }

  return (
    <AdminPage
      actions={
        <Btn disabled={waiting.length === 0} onClick={() => setDispatching(true)} variant="solid">
          <Truck aria-hidden size={15} strokeWidth={1.8} /> Dispatch an order
        </Btn>
      }
      eyebrow="Shipping · In flight"
      icon={Truck}
      lede="Every parcel the store has sent. A confirmed order becomes one the day it is dispatched; cancelling its order cancels it here too."
      spec={[
        { label: "To dispatch", value: String(waiting.length).padStart(2, "0") },
        { label: "Parcels", value: String(shipments.length).padStart(2, "0") },
      ]}
      title={
        <>
          Active <em>shipments</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      {waiting.length > 0 && (
        <Note icon={PackageCheck} title={`${waiting.length} confirmed ${waiting.length === 1 ? "order is" : "orders are"} waiting to go out`} tone="warn">
          {waiting.map((order) => order.id).join(", ")} — dispatch one to give it a courier and a
          date, and it appears below as a parcel.
        </Note>
      )}

      <RecordManager
        columns={SHIPMENT_COLUMNS}
        emptyHint="Nothing has been dispatched yet. Confirm an order, then dispatch it to create its first parcel."
        fields={SHIPMENT_FIELDS}
        /* The form picks a date, the column reads a day — and an untouched
           date input submits nothing, which would otherwise wipe the day a
           parcel already went out on. */
        derive={(values, _rows, previous) => ({
          ...values,
          dispatched: values.dispatched
            ? readableDate(values.dispatched)
            : (previous?.dispatched ?? ""),
        })}
        filterKey="status"
        filterValues={[...SHIPMENT_STATES]}
        icon={Truck}
        idPrefix="shp"
        onCommit={commitShipments}
        rowHref={(row) => `/admin/shipments/${row.id}`}
        rows={shipments}
        singular="shipment"
        tone="sky"
        rowAction={(row) => {
          const step = NEXT_SHIPMENT_STEP[row.status];
          if (!step) return null;

          return [
            {
              icon: step.to === "Delivered" ? CheckCircle2 : Route,
              tone: "good" as const,
              label: `${step.verb} · ${row.id}`,
              patch: { status: step.to },
              toast: { title: `Shipment ${step.to.toLowerCase()}`, description: `${row.id} ${step.said}.` },
            },
            {
              icon: step.exit.to === "Cancelled" ? Ban : AlertTriangle,
              tone: "danger" as const,
              label: `${step.exit.verb} · ${row.id}`,
              patch: { status: step.exit.to },
              toast: {
                title: step.exit.title,
                description: `${row.id} ${step.exit.said}.`,
              },
            },
          ];
        }}
      />

      {/* Dispatching asks two questions and no more: who carries it, and when
          it goes. Everything else about the parcel is already known from the
          order it belongs to. */}
      <Modal
        footer={
          <>
            <Btn onClick={() => setDispatching(false)}>Cancel</Btn>
            <Btn form="dispatch-form" type="submit" variant="solid">
              Dispatch order
            </Btn>
          </>
        }
        description="The order leaves the warehouse on the day you choose and becomes a parcel with that date on it."
        icon={Truck}
        onOpenChange={setDispatching}
        open={dispatching}
        title="Dispatch an order"
        tone="sky"
      >
        <form className="aui-form aui-form--2" id="dispatch-form" onSubmit={dispatch}>
          <Field full label="Order">
            <Select
              ariaLabel="Order to dispatch"
              defaultValue={waiting[0]?.id}
              name="order"
              options={waiting.map((order) => order.id)}
              placeholder="No confirmed orders are waiting"
              required
            />
          </Field>
          <Field label="Courier">
            <Select ariaLabel="Courier" defaultValue={COURIERS[0]} name="provider" options={[...COURIERS]} />
          </Field>
          <Field help="Defaults to today." label="Dispatch date">
            <input defaultValue={todayValue()} name="dispatched" type="date" />
          </Field>
        </form>
      </Modal>
    </AdminPage>
  );
}
