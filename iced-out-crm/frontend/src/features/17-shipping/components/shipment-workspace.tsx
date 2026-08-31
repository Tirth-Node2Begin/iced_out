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
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useRegister } from "@/api/use-register";
import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { AdminPage, Btn, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
  type RowAction,
} from "@/components/shell/record-manager";
import { awaitingDispatch, useFulfilment } from "@/features/07-orders/fulfilment-context";
import { ShipmentTabs } from "@/features/17-shipping/components/shipment-tabs";
import { COURIERS, SHIPMENT_STATES } from "@/features/17-shipping/shipment-states";

export type ShipmentView = "active" | "failed" | "pickups";

/**
 * Shipments live as one register per view, with the courier and the promise
 * as columns rather than as a decorated card — a dispatcher reads down a
 * column of promises, not across twenty cards.
 *
 * A shipment starts when an order is DISPATCHED, which is why the active view
 * opens by offering the confirmed orders that nothing is carrying yet: pick the
 * courier, and the parcel exists from then on.
 *
 * Every register here is READ-ONLY, and that is a correction. They used to offer
 * "New shipment", with fields for an order number and an AWB — a form for
 * inventing a parcel. A parcel comes into existence when an order is dispatched,
 * and the server is what mints its id, its AWB and its dispatch date
 * (`ShipmentService`). What an operator does to one afterwards is move it along,
 * and every one of those moves is its own endpoint.
 */

const SHIPMENT_COLUMNS: Column[] = [
  { key: "id", label: "Shipment", primary: true, sub: "awb" },
  { key: "order", label: "Order" },
  { key: "provider", label: "Courier", hideSmall: true },
  { key: "destination", label: "Destination", hideSmall: true },
  { key: "dispatched", label: "Dispatched", align: "right", hideSmall: true },
  { key: "status", label: "State", status: true },
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

/* The failure reasons a courier can give are a SETTINGS vocabulary the server
   validates against (`ShipmentService`), and a parcel is marked failed on the
   active screen rather than typed in here — so the list this file used to hold is
   gone with the form that offered it. */

const FAILED_COLUMNS: Column[] = [
  { key: "id", label: "Parcel", primary: true, sub: "order" },
  { key: "reason", label: "What went wrong" },
  { key: "provider", label: "Courier", hideSmall: true },
  { key: "destination", label: "Going to", hideSmall: true },
  { key: "handling", label: "Status", status: true },
];

function FailedDeliveries() {
  const { shipments, ready, loading, error, shipmentAction } = useFulfilment();

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
        toolbarLead={<ShipmentTabs />}
        columns={FAILED_COLUMNS}
        emptyHint="Nothing has failed. If a parcel is marked failed on active shipments, it appears here by itself."
        error={error}
        fields={[]}
        filterKey="handling"
        filterValues={[NEEDS_ACTION, SENDING_BACK]}
        icon={AlertTriangle}
        loaded={ready}
        loading={loading}
        readOnly
        rows={failed}
        searchKeys={["id", "order", "reason", "provider", "destination", "handling"]}
        singular="failed delivery"
        plural="failed deliveries"
        tone="rose"
        statusTone={(row) => (row.handling === SENDING_BACK ? "info" : "warn")}
        rowAction={(row) => {
          /* Each of the three verbs is the endpoint that owns it. `resend` also
             counts the NDR attempt and refuses a fourth; `arrived-back` closes the
             parcel and puts the stock back. Neither is something a status patch
             could have done. */
          if (row.handling === SENDING_BACK) {
            return {
              icon: PackageCheck,
              tone: "good" as const,
              label: `${row.id} is back in the store`,
              onSelect: () => shipmentAction(row.id, "arrived-back"),
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
              onSelect: () => shipmentAction(row.id, "resend"),
              toast: {
                title: "Out for delivery again",
                description: `${row.id} is back with ${row.provider}.`,
              },
            },
            {
              icon: Undo2,
              tone: "danger" as const,
              label: `Send ${row.id} back to the store`,
              onSelect: () => shipmentAction(row.id, "return-to-store"),
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
  /* `/admin/pickups`, not three rows held in `useState`. A pickup is a batch a
     driver physically collects, so it has to be the same batch for whoever is at
     the desk when the van arrives. */
  const pickups = useRegister(
    useMemo(
      () => ({
        path: "/admin/pickups",
        toCreate: (values: RecordRow) => ({
          provider: values.provider,
          parcels: Number(values.parcels ?? 0) || 0,
          pickup: values.pickup,
        }),
      }),
      [],
    ),
  );

  const rows = pickups.rows;
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
        toolbarLead={<ShipmentTabs />}
        columns={PICKUP_COLUMNS}
        emptyHint="No pickups yet. Start one for the courier collecting today, then hand it over when the driver arrives."
        error={pickups.error}
        fields={PICKUP_FIELDS}
        filterKey="status"
        filterValues={[PICKUP_OPEN, PICKUP_DONE]}
        icon={PackageCheck}
        loaded={pickups.loaded}
        loading={pickups.loading}
        onCreate={pickups.onCreate}
        singular="pickup"
        tone="violet"
        statusTone={(row) => (row.status === PICKUP_DONE ? "good" : "warn")}
        /* A batch is created open and then handed over; there is nothing else to
           edit about it, and no endpoint to delete one — a pickup that happened
           happened. So neither verb is offered, and the state is not a field. */
        rowAction={(row) =>
          row.status === PICKUP_OPEN
            ? {
                icon: Truck,
                tone: "good" as const,
                label: `Hand ${row.id} to ${row.provider}`,
                onSelect: () =>
                  pickups.act(`/admin/pickups/${encodeURIComponent(row.id)}/handover`),
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

/* The two date helpers that used to live here — one to seed a date input with
   today, one to render `2026-08-06` as "06 Aug" — are gone with the dispatch
   dialog's date field. The server stamps a parcel's dispatch date at the moment
   it creates the shipment, and formats it for the column; a date typed in a
   browser could only ever disagree with the record it described. */

function ActiveShipments() {
  const { orders, shipments, ready, loading, error, dispatchOrder, transitionShipment } =
    useFulfilment();
  const [dispatching, setDispatching] = useState(false);
  const [sending, setSending] = useState(false);

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

  /**
   * Hands an order to a courier.
   *
   * The dispatch date is deliberately not asked for any more. The server stamps
   * it — along with the AWB, the delivery promise and the parcel's id — at the
   * moment the shipment is created, and a date typed in a browser could disagree
   * with the record it is supposed to describe. Two questions became one.
   */
  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderId = String(form.get("order") ?? "");
    const provider = String(form.get("provider") ?? COURIERS[0]);

    if (!orderId) return;

    setSending(true);

    try {
      await dispatchOrder({ orderId, provider });
      setDispatching(false);
      toast.success("Order dispatched", {
        description: `${orderId} left with ${provider}.`,
      });
    } catch (caught) {
      /* The server refuses an unconfirmed order and a second live parcel. Both
         are worth reading rather than swallowing. */
      toast.error("That could not be dispatched", {
        description: caught instanceof Error ? caught.message : "The server refused the change.",
      });
    } finally {
      setSending(false);
    }
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
        toolbarLead={<ShipmentTabs />}
        columns={SHIPMENT_COLUMNS}
        emptyHint="Nothing has been dispatched yet. Confirm an order, then dispatch it to create its first parcel."
        error={error}
        fields={[]}
        filterKey="status"
        filterValues={[...SHIPMENT_STATES]}
        icon={Truck}
        loaded={ready}
        loading={loading}
        readOnly
        rowHref={(row) => `/shipments/detail?id=${encodeURIComponent(row.id)}`}
        rows={shipments}
        singular="shipment"
        tone="sky"
        rowAction={(row) => {
          const step = NEXT_SHIPMENT_STEP[row.status];
          if (!step) return null;

          /* Each move is `POST /admin/shipments/{id}/transition`, which also
             writes the event a customer sees on the tracking page — a patched
             status column would have changed the word on this screen and nothing
             else. */
          return [
            {
              icon: step.to === "Delivered" ? CheckCircle2 : Route,
              tone: "good" as const,
              label: `${step.verb} · ${row.id}`,
              onSelect: () => transitionShipment(row.id, step.to),
              toast: { title: `Shipment ${step.to.toLowerCase()}`, description: `${row.id} ${step.said}.` },
            },
            {
              icon: step.exit.to === "Cancelled" ? Ban : AlertTriangle,
              tone: "danger" as const,
              label: `${step.exit.verb} · ${row.id}`,
              onSelect: () => transitionShipment(row.id, step.exit.to),
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
            <Btn disabled={sending} onClick={() => setDispatching(false)}>
              Cancel
            </Btn>
            <Btn disabled={sending} form="dispatch-form" type="submit" variant="solid">
              {sending ? "Dispatching…" : "Dispatch order"}
            </Btn>
          </>
        }
        description="The order leaves the warehouse now and becomes a parcel, with its AWB and delivery promise stamped on it."
        icon={Truck}
        onOpenChange={setDispatching}
        open={dispatching}
        title="Dispatch an order"
        tone="sky"
      >
        <form
          className="aui-form aui-form--2"
          id="dispatch-form"
          onSubmit={(event) => void dispatch(event)}
        >
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
        </form>
      </Modal>
    </AdminPage>
  );
}
