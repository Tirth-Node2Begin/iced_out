"use client";

import { Ban, CheckCircle2, IndianRupee, ShoppingBag } from "lucide-react";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { AdminPage } from "@/components/shell/admin-ui";
import { RecordManager, type Column } from "@/components/shell/record-manager";
import { formatPrice } from "@/features/02-products/utils/format-price";
import { ORDER_STATES } from "@/features/07-orders/order-states";
import { useFulfilment } from "@/features/07-orders/fulfilment-context";

/**
 * The order register.
 *
 * An order is `Placed`, then `Confirmed`, or it is `Cancelled` — and that is
 * the whole vocabulary. Where the parcel has got to is the shipments screen's
 * business; keeping "dispatched" out of here is what stops one order having
 * two answers to "what state is it in".
 *
 * Both verbs are on the row: confirm it, or call it off. Each is one endpoint —
 * `POST /admin/orders/{number}/confirm` and `.../cancel` — and cancelling also
 * cancels anything already out for that order and releases the stock it was
 * holding, in one server transaction.
 *
 * The register is READ-ONLY, and that is a correction rather than a limitation.
 * It used to offer "New order", with fields for a customer name and an order
 * value: a form for inventing a sale nobody made. Orders arrive from checkout.
 * What an operator does to one is agree it or call it off, which is what the two
 * row verbs are for.
 */

const money = (value: string) => formatPrice(Number(value) || 0);

const STATUS_ORDER = [...ORDER_STATES];

const COLUMNS: Column[] = [
  {
    key: "id",
    label: "Order",
    render: (row) => (
      <span className="aui-table__primary">
        <strong>{row.id}</strong>
        <small>{row.items === "1" ? "1 item" : `${row.items || 0} items`}</small>
      </span>
    ),
  },
  { key: "customer", label: "Customer" },
  {
    key: "payment",
    label: "Payment",
    status: true,
    hideSmall: true,
    render: (row) => (
      <span className="aui-table__primary">
        <strong>{row.payment}</strong>
        <small>{row.method}</small>
      </span>
    ),
  },
  { key: "value", label: "Value", align: "right", numeric: true, render: (row) => money(row.value) },
  {
    key: "status",
    label: "Status",
    status: true,
    /* A cancelled row says who called it off, which is the only thing anyone
       asks next. */
    render: (row) =>
      row.status === "Cancelled" ? (
        <span className="aui-table__primary">
          <strong>Cancelled</strong>
          <small>by {row.cancelledBy?.toLowerCase() ?? "store"}</small>
        </span>
      ) : (
        <span className="aui-status" data-tone={row.status === "Confirmed" ? "good" : "warn"}>
          {row.status}
        </span>
      ),
  },
];

export function AdminOrdersWorkspace() {
  const { orders, ready, loading, error, confirmOrder, cancelOrder } = useFulfilment();

  const placed = orders.filter((order) => order.status === "Placed");
  const confirmed = orders.filter((order) => order.status === "Confirmed");
  const cancelled = orders.filter((order) => order.status === "Cancelled");

  /* A cancelled order is not money the store is going to see. */
  const liveValue = orders
    .filter((order) => order.status !== "Cancelled")
    .reduce((total, order) => total + (Number(order.value) || 0), 0);

  const stats: Stat[] = [
    {
      label: "Placed",
      value: String(placed.length).padStart(2, "0"),
      icon: ShoppingBag,
      tone: "amber",
      note: placed.length ? "Waiting on a person" : "Nothing waiting",
    },
    {
      label: "Confirmed",
      value: String(confirmed.length).padStart(2, "0"),
      icon: CheckCircle2,
      tone: "mint",
      note: "Agreed and payable",
    },
    {
      label: "Cancelled",
      value: String(cancelled.length).padStart(2, "0"),
      icon: Ban,
      tone: "rose",
      note: cancelled.length ? `${cancelled.filter((order) => order.cancelledBy === "Customer").length} by customers` : "None",
    },
    {
      label: "Order value",
      value: formatPrice(liveValue),
      icon: IndianRupee,
      tone: "sky",
      note: "Excludes cancelled orders",
    },
  ];

  return (
    <AdminPage
      eyebrow="Orders"
      icon={ShoppingBag}
      lede="Every order in one list. Confirm it, or call it off — anything already out for a cancelled order is cancelled with it."
      spec={[
        { label: "Orders", value: String(orders.length).padStart(2, "0") },
        { label: "Value", value: formatPrice(liveValue) },
      ]}
      title={
        <>
          Order <em>register</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        emptyHint="No orders yet. They arrive here the moment a shopper checks out."
        error={error}
        fields={[]}
        filterKey="status"
        filterValues={STATUS_ORDER}
        icon={ShoppingBag}
        idKey="id"
        loaded={ready}
        loading={loading}
        readOnly
        rowHref={(row) => `/orders/detail?id=${encodeURIComponent(row.id)}`}
        rows={orders}
        singular="order"
        tone="sky"
        rowAction={(row) => {
          if (row.status === "Cancelled") return null;

          /* Both verbs go through their own endpoint rather than patching the row:
             confirming writes a history entry and cancelling reaches the parcel
             and the stock as well. `onSelect` is awaited by the register, so a
             refusal — a payment that has since failed, an order somebody else
             just cancelled — is reported instead of being drawn as done. */
          const cancel = {
            icon: Ban,
            tone: "danger" as const,
            label: `Cancel ${row.id}`,
            onSelect: () => cancelOrder(row.id, "Store"),
            toast: {
              title: "Order cancelled",
              description: `${row.id} was called off by the store.`,
            },
          };

          if (row.status !== "Placed") return cancel;

          const blocked = row.payment === "Failed";

          return [
            {
              icon: CheckCircle2,
              tone: "good" as const,
              disabled: blocked,
              label: blocked
                ? `Payment failed — ${row.id} cannot be confirmed`
                : `Confirm ${row.id}`,
              onSelect: () => confirmOrder(row.id),
              toast: { title: "Order confirmed", description: `${row.id} is ready to dispatch.` },
            },
            cancel,
          ];
        }}
      />
    </AdminPage>
  );
}
