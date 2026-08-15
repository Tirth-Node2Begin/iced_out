"use client";

import { Ban, CheckCircle2, IndianRupee, ShoppingBag } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage } from "@/components/admin/admin-ui";
import { RecordManager, type Column, type FormField } from "@/components/admin/record-manager";
import { formatPrice } from "@/features/02-products/utils/format-price";
import {
  ORDER_STATES,
  PAYMENT_METHODS,
  PAYMENT_STATES,
} from "@/features/07-orders/data/admin-order-fixtures";
import { useFulfilment } from "@/features/07-orders/fulfilment-context";

/**
 * The order register.
 *
 * An order is `Placed`, then `Confirmed`, or it is `Cancelled` — and that is
 * the whole vocabulary. Where the parcel has got to is the shipments screen's
 * business; keeping "dispatched" out of here is what stops one order having
 * two answers to "what state is it in".
 *
 * Both verbs are on the row: confirm it, or call it off. Cancelling from here
 * also cancels anything already out for that order — see the store.
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

const FIELDS: FormField[] = [
  { key: "customer", label: "Customer", placeholder: "Full name", required: true },
  { key: "items", label: "Items", type: "number", min: "1", initial: "1", required: true },
  {
    key: "value",
    label: "Order value",
    hint: "₹",
    type: "number",
    min: "0",
    step: "100",
    placeholder: "17800",
    required: true,
  },
  { key: "payment", label: "Payment", type: "select", options: [...PAYMENT_STATES] },
  { key: "method", label: "Paid by", type: "select", options: [...PAYMENT_METHODS] },
  { key: "status", label: "Status", type: "select", options: [...ORDER_STATES] },
];

export function AdminOrdersWorkspace() {
  const { orders, commitOrders, cancelOrder } = useFulfilment();

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
        fields={FIELDS}
        filterKey="status"
        filterValues={STATUS_ORDER}
        icon={ShoppingBag}
        idKey="id"
        idPrefix="IO-2026"
        onCommit={commitOrders}
        rowHref={(row) => `/admin/orders/${row.id}`}
        rows={orders}
        singular="order"
        tone="sky"
        rowAction={(row) => {
          if (row.status === "Cancelled") return null;

          /* Cancelling is not a patch like the others — it has to reach the
             shipment too — so it goes through the store rather than through
             the register's own writer. */
          const cancel = {
            icon: Ban,
            tone: "danger" as const,
            label: `Cancel ${row.id}`,
            patch: {},
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
              patch: { status: "Confirmed" },
              toast: { title: "Order confirmed", description: `${row.id} is ready to dispatch.` },
            },
            cancel,
          ];
        }}
      />
    </AdminPage>
  );
}
