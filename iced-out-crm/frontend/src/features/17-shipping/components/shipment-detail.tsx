"use client";

import { CheckCircle2, MapPin, PackageCheck, Printer, RefreshCw, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import {
  AdminPage,
  Btn,
  DetailList,
  Empty,
  Note,
  Panel,
  Section,
  Timeline,
} from "@/components/shell/admin-ui";
import { useAdminRecord } from "@/api/use-register";
import { useFulfilment } from "@/features/07-orders/fulfilment-context";

/** One row of `shipment_events`, as `GET /admin/shipments/{id}` presents it. */
type ShipmentEvent = {
  label: string;
  detail: string;
  time: string;
  complete: boolean;
};

/**
 * One shipment, with the courier's own timeline beside the store's record of
 * it. The two verbs that exist at this level — reprint the label, re-query the
 * provider — sit in the masthead like every other screen's actions, and both
 * now reach the endpoint they name rather than only raising a toast.
 */
export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  /* Read from the store, not from the seed list: a parcel created by
     dispatching an order this session is not in the fixtures, and falling back
     to the first fixture would show somebody else's shipment under this id. */
  const { shipments, shipmentAction } = useFulfilment();
  const shipment = shipments.find((entry) => entry.id === shipmentId);

  /* The courier's own events, which only the SHOW endpoint carries — the index
     this screen reads its row from does not include them. They were four
     hardcoded strings until now, under a heading promising the provider's
     evidence, so a parcel scanned in Delhi read "BLR origin facility" and an
     AWB generated this morning read "05 Aug". */
  const detail = useAdminRecord<{ events?: ShipmentEvent[] }>(
    shipmentId === "" ? null : `/admin/shipments/${encodeURIComponent(shipmentId)}`,
  );
  const events = detail.data?.events ?? [];

  /* One flag for both verbs: they are the only two on this screen and neither
     is safe to fire twice while the first is still in flight. */
  const [busy, setBusy] = useState(false);

  const run = async (action: string, done: string, describe: string) => {
    setBusy(true);
    try {
      await shipmentAction(shipmentId, action);
      await detail.reload();
      toast.success(done, { description: describe });
    } catch (error) {
      toast.error("That did not go through", {
        description: error instanceof Error ? error.message : "The courier could not be reached.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!shipment) {
    return (
      <AdminPage
        back={{ href: "/shipments/active", label: "Shipments" }}
        eyebrow="Shipment"
        icon={Truck}
        title={
          <>
            Shipment <em>{shipmentId}</em>
          </>
        }
      >
        <Empty
          copy="No parcel with this number is in the register. An order has to be dispatched before it has one."
          icon={Truck}
          title="Not found"
        />
      </AdminPage>
    );
  }

  const rail: Stat[] = [
    { label: "Order", value: shipment.order, icon: PackageCheck, tone: "sky", note: "1 package" },
    { label: "Courier", value: shipment.provider, icon: Truck, tone: "violet", note: `AWB ${shipment.awb}` },
    { label: "Destination", value: shipment.destination, icon: MapPin, tone: "amber", note: "Full address restricted" },
    { label: "Promise", value: shipment.promise, icon: CheckCircle2, tone: "mint", note: "Latest provider quote" },
  ];

  return (
    <AdminPage
      actions={
        <>
          <Btn
            disabled={busy}
            onClick={() =>
              run("refresh", "Provider re-queried", `${shipment.id} refreshed from ${shipment.provider}.`)
            }
            variant="solid"
          >
            <RefreshCw aria-hidden size={15} strokeWidth={1.7} /> Refresh provider state
          </Btn>
          <Btn disabled={busy} onClick={() => run("label", "Label ready", `AWB ${shipment.awb} reprinted.`)}>
            <Printer aria-hidden size={15} strokeWidth={1.7} /> Reprint label
          </Btn>
        </>
      }
      back={{ href: "/shipments/active", label: "Shipments" }}
      eyebrow="Shipping · Shipment"
      icon={Truck}
      lede={`${shipment.order} · ${shipment.provider} · AWB ${shipment.awb}. The courier's evidence and the store's record of it, side by side.`}
      spec={[
        { label: "State", value: shipment.status },
        { label: "Promise", value: shipment.promise },
        { label: "Courier", value: shipment.provider },
      ]}
      title={
        <>
          Shipment <em>{shipment.id}</em>
        </>
      }
    >
      <StatGrid stats={rail} />

      <div className="aui-grid aui-grid--2">
        <Section copy="Events as the courier reported them, oldest first." eyebrow="Provider" title="Courier timeline">
          <Panel>
            {detail.error ? (
              <Note tone="bad" title="Could not read the courier's events">
                {detail.error}
              </Note>
            ) : events.length > 0 ? (
              <Timeline
                steps={events.map((event) => ({
                  title: event.label,
                  /* The time is part of the line rather than a column of its
                     own: `Timeline` renders one detail string per step, and a
                     scan without its timestamp is not evidence of anything. */
                  detail: [event.time, event.detail].filter(Boolean).join(" · "),
                  done: event.complete,
                }))}
              />
            ) : (
              <Empty
                copy={
                  detail.loaded
                    ? "The courier has not reported anything against this parcel yet. Re-query the provider to check again."
                    : "Reading the courier's events…"
                }
                icon={Truck}
                inline
                title={detail.loaded ? "No events yet" : "Loading"}
              />
            )}
          </Panel>
        </Section>

        <Section copy="What the store recorded when this shipment was created." eyebrow="Record" title="Shipment facts">
          <Panel>
            <div style={{ display: "grid", gap: 14 }}>
              <DetailList
                rows={[
                  { label: "Shipment", value: shipment.id },
                  { label: "Order", value: shipment.order },
                  { label: "Courier", value: shipment.provider },
                  { label: "Tracking number", value: shipment.awb },
                  { label: "Destination", value: shipment.destination },
                  { label: "Dispatched", value: shipment.dispatched ?? "—" },
                  { label: "Promise", value: shipment.promise ?? "—" },
                  { label: "State", value: shipment.status },
                ]}
              />
              <Note icon={RefreshCw}>
                Reprinting reuses the existing AWB rather than requesting a new one — two waybills
                for one parcel is how a package gets scanned twice and lost once.
              </Note>
            </div>
          </Panel>
        </Section>
      </div>
    </AdminPage>
  );
}
