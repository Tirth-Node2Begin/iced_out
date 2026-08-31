"use client";

import { Ban, CheckCircle2, CreditCard, Package, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import {
  AdminPage,
  Btn,
  ConfirmDialog,
  Empty,
  Panel,
  Section,
  Timeline,
} from "@/components/shell/admin-ui";
import { useAdminRecord } from "@/api/use-register";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { shipmentForOrder, useFulfilment } from "@/features/07-orders/fulfilment-context";

/** One line of the bag, as `OrderPresenter::lines` returns it. */
type OrderLine = {
  productId: string;
  name: string;
  size: string;
  qty: number;
  price: number;
};

/** One entry of the order's own history, from `order_status_history`. */
type TimelineEntry = { label: string; at: string; actor: string; note: string };

/** What `GET /admin/orders/{number}` answers with. */
type OrderDetail = {
  row: Record<string, string>;
  lines: OrderLine[];
  timeline: TimelineEntry[];
};

/** What one line came to: quantity times the price of one. */
function lineTotal(line: OrderLine) {
  return line.qty * line.price;
}

/**
 * One order, and only what a person actually needs from it: what was bought,
 * what it cost, whether it is paid and how, and where it has got to.
 *
 * Everything that used to pad this screen — warehouse copy, refund previews,
 * a "frozen order lines" ceremony around a price list — is gone. The four
 * numbers at the top are the four questions, and the timeline underneath is
 * read from the order and its parcel rather than typed out, so it is never a
 * story about a state the record is not in.
 *
 * The lines are read from `GET /admin/orders/{number}`, which returns what was
 * actually bought at the prices it was bought at. They used to come from a
 * fixture keyed by order number, so an order placed through checkout — a real one
 * — opened here with an empty bag and a total of zero.
 */
export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const { shipments, confirmOrder, cancelOrder } = useFulfilment();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const detail = useAdminRecord<OrderDetail>(`/admin/orders/${encodeURIComponent(orderId)}`);
  const order = detail.data?.row;
  const lines = detail.data?.lines ?? [];
  const history = detail.data?.timeline ?? [];
  const shipment = shipmentForOrder(shipments, orderId);

  /* "Reading it" is not "there is no such order". Without this the screen said
     "Not found" for as long as the request took. */
  if (!order && !detail.loaded) {
    return (
      <AdminPage
        back={{ href: "/orders", label: "Orders" }}
        eyebrow="Order"
        icon={ShoppingBag}
        title={
          <>
            Order <em>{orderId}</em>
          </>
        }
      >
        <Empty copy="Reading this order…" icon={ShoppingBag} title="Loading" />
      </AdminPage>
    );
  }

  if (!order) {
    return (
      <AdminPage
        back={{ href: "/orders", label: "Orders" }}
        eyebrow="Order"
        icon={ShoppingBag}
        title={
          <>
            Order <em>{orderId}</em>
          </>
        }
      >
        <Empty
          copy={detail.error ?? "No order with this number is in the register."}
          icon={ShoppingBag}
          title={detail.error ? "Could not be read" : "Not found"}
        />
      </AdminPage>
    );
  }

  const total = Number(order.value) || 0;
  const items = lines.reduce((count, line) => count + line.qty, 0) || Number(order.items) || 0;
  const cancelled = order.status === "Cancelled";
  const paid = order.payment === "Captured";

  const stats: Stat[] = [
    {
      label: "Order",
      value: order.status,
      icon: cancelled ? Ban : CheckCircle2,
      tone: cancelled ? "rose" : order.status === "Confirmed" ? "mint" : "amber",
      note: cancelled ? `Cancelled by ${order.cancelledBy?.toLowerCase() ?? "store"}` : order.customer,
    },
    {
      label: "Payment",
      value: order.payment,
      icon: CreditCard,
      tone: paid ? "mint" : order.payment === "Failed" ? "rose" : "amber",
      /* The mode only means anything once the money actually moved. */
      note: paid ? `Paid by ${order.method}` : `${order.method} · not captured`,
    },
    {
      label: "Items",
      value: String(items).padStart(2, "0"),
      icon: Package,
      tone: "sky",
      note: `${lines.length || 1} ${lines.length === 1 ? "product" : "products"}`,
    },
    {
      label: "Total",
      value: formatPrice(total),
      icon: ShoppingBag,
      tone: "violet",
      note: "Including shipping and tax",
    },
  ];

  return (
    <AdminPage
      actions={
        <>
          {order.status === "Placed" && (
            <Btn
              disabled={busy || order.payment === "Failed"}
              onClick={() => {
                setBusy(true);
                confirmOrder(orderId)
                  .then(() => detail.reload())
                  .then(() =>
                    toast.success("Order confirmed", {
                      description: `${orderId} is ready to dispatch.`,
                    }),
                  )
                  .catch((caught: unknown) =>
                    toast.error("That could not be confirmed", {
                      description:
                        caught instanceof Error
                          ? caught.message
                          : "The server refused the change.",
                    }),
                  )
                  .finally(() => setBusy(false));
              }}
              variant="solid"
            >
              <CheckCircle2 aria-hidden size={15} strokeWidth={1.8} />{" "}
              {busy ? "Working…" : "Confirm order"}
            </Btn>
          )}
          {!cancelled && (
            <Btn disabled={busy} onClick={() => setCancelOpen(true)} variant="danger">
              <Ban aria-hidden size={15} strokeWidth={1.8} /> Cancel order
            </Btn>
          )}
        </>
      }
      back={{ href: "/orders", label: "Orders" }}
      eyebrow="Order"
      icon={ShoppingBag}
      title={
        <>
          Order <em>{orderId}</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <div className="aui-grid aui-grid--2">
        <Section eyebrow="Bag" title="What was ordered">
          <Panel flush>
            <table className="aui-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th data-align="right" scope="col">
                    Qty
                  </th>
                  <th data-align="right" scope="col">
                    Each
                  </th>
                  <th data-align="right" scope="col">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={`${line.productId}-${line.size}`}>
                    <td>
                      <span className="aui-table__primary">
                        <strong>{line.name}</strong>
                        <small>Size {line.size}</small>
                      </span>
                    </td>
                    <td className="aui-table__num" data-align="right">
                      ×{line.qty}
                    </td>
                    <td className="aui-table__num" data-align="right">
                      {formatPrice(line.price)}
                    </td>
                    <td className="aui-table__num" data-align="right">
                      {formatPrice(lineTotal(line))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <strong>Total paid</strong>
                  </td>
                  <td className="aui-table__num" data-align="right">
                    <strong>{formatPrice(total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </Section>

        <Section eyebrow="Progress" title="Where it is">
          <Panel>
            <Timeline steps={progress(order, shipment, history)} />
          </Panel>
        </Section>
      </div>

      <ConfirmDialog
        confirmLabel="Cancel order"
        description={
          shipment && shipment.status !== "Delivered"
            ? `${orderId} will be cancelled, and ${shipment.id} — the parcel carrying it — is cancelled with it.`
            : `${orderId} will be cancelled and the stock reservation released.`
        }
        onConfirm={() => {
          setBusy(true);
          cancelOrder(orderId, "Store")
            .then(() => detail.reload())
            .then(() =>
              toast.success("Order cancelled", {
                description: shipment
                  ? `${orderId} and ${shipment.id} were called off.`
                  : `${orderId} was called off by the store.`,
              }),
            )
            .catch((caught: unknown) =>
              toast.error("That could not be cancelled", {
                description:
                  caught instanceof Error ? caught.message : "The server refused the change.",
              }),
            )
            .finally(() => setBusy(false));
        }}
        onOpenChange={setCancelOpen}
        open={cancelOpen}
        title="Cancel this order?"
      />
    </AdminPage>
  );
}

/**
 * The order's journey, read rather than written.
 *
 * Every step's state comes from the order and its parcel, so the screen cannot
 * claim a parcel is in transit for an order nobody has confirmed — and a
 * cancelled order stops the story where it actually stopped.
 */
function progress(
  order: Record<string, string>,
  shipment: Record<string, string> | undefined,
  history: TimelineEntry[],
) {
  const cancelled = order.status === "Cancelled";
  const confirmed = order.status === "Confirmed";
  const state = shipment?.status;

  const steps = [
    {
      title: "Placed",
      /* The order's own first history entry, rather than a lookup in a fixture
         table that only knew about the seeded order numbers. */
      detail: history[0]?.at || order.age ? `${order.age} ago` : "When it arrived",
      done: true,
    },
    {
      title: order.payment === "Captured" ? `Paid · ${order.method}` : `Payment ${order.payment.toLowerCase()}`,
      detail:
        order.payment === "Captured"
          ? "Amount and signature matched"
          : order.payment === "Refunded"
            ? "Returned to the original method"
            : "Waiting on the payment provider",
      done: order.payment === "Captured" || order.payment === "Refunded",
    },
    {
      title: "Confirmed",
      detail: confirmed || shipment ? "Agreed by the store" : "Waiting on a person",
      done: confirmed || Boolean(shipment),
    },
    {
      title: "Dispatched",
      detail: shipment
        ? `${shipment.dispatched} · ${shipment.provider}`
        : "Not yet handed to a courier",
      done: Boolean(shipment) && shipment?.status !== "Cancelled",
    },
    {
      title: state === "Failed" ? "Delivery failed" : "Delivered",
      detail:
        state === "Delivered"
          ? "Signed for at the door"
          : state === "Failed"
            ? "Needs a second attempt"
            : state === "In transit"
              ? "With the courier"
              : "Not out for delivery yet",
      done: state === "Delivered",
    },
  ];

  if (!cancelled) return steps;

  /* A cancelled order keeps what actually happened and ends there — showing it
     the rest of a journey it will never take would be a lie with a tick on it. */
  return [
    ...steps.filter((step) => step.done),
    {
      title: "Cancelled",
      detail: `Called off by ${order.cancelledBy?.toLowerCase() ?? "the store"}${
        shipment ? ` · ${shipment.id} cancelled with it` : ""
      }`,
      done: true,
    },
  ];
}
