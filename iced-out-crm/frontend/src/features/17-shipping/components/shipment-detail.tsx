"use client";

import { CheckCircle2, MapPin, PackageCheck, Printer, RefreshCw, Truck } from "lucide-react";
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
import { useFulfilment } from "@/features/07-orders/fulfilment-context";

/**
 * One shipment, with the courier's own timeline beside the store's record of
 * it. The two verbs that exist at this level — reprint the label, re-query the
 * provider — sit in the masthead like every other screen's actions.
 */
export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  /* Read from the store, not from the seed list: a parcel created by
     dispatching an order this session is not in the fixtures, and falling back
     to the first fixture would show somebody else's shipment under this id. */
  const { shipments } = useFulfilment();
  const shipment = shipments.find((entry) => entry.id === shipmentId);

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
            onClick={() => toast.success("Provider re-queried", { description: `${shipment.id} refreshed from ${shipment.provider}.` })}
            variant="solid"
          >
            <RefreshCw aria-hidden size={15} strokeWidth={1.7} /> Refresh provider state
          </Btn>
          <Btn onClick={() => toast.success("Label sent to printer", { description: `AWB ${shipment.awb} reprinted.` })}>
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
        <Section copy="Events as the courier reported them, newest last." eyebrow="Provider" title="Courier timeline">
          <Panel>
            <Timeline
              steps={[
                { title: "AWB generated", detail: "05 Aug · 09:14 · idempotent provider request", done: true },
                { title: "First physical scan", detail: "05 Aug · 18:06 · BLR origin facility", done: true },
                { title: "In transit", detail: "Latest event · provider projection", done: shipment.status !== "Dispatched" },
                { title: "Delivered", detail: shipment.promise, done: shipment.status === "Delivered" },
              ]}
            />
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
                  { label: "AWB", value: shipment.awb },
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
