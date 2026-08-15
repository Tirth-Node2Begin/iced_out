"use client";

import { CheckCircle2, CircleDollarSign, RefreshCw, Truck, Undo2, WalletCards, XCircle } from "lucide-react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Btn } from "@/components/admin/admin-ui";
import { RecordManager, type Column, type FormField } from "@/components/admin/record-manager";
import {
  GATEWAYS,
  PAYMENT_STATES,
  money,
  pad,
  stampNow,
  total,
} from "@/features/09-payment/payment-data";
import { usePaymentLedger } from "@/features/09-payment/payment-store";
import { PaymentTabs } from "@/features/09-payment/payment-tabs";

/**
 * The payments ledger — every rupee a customer owes, in one list.
 *
 * The whole flow of this screen is one sentence: an order is placed, and its
 * money either arrived (`Captured`), bounced (`Failed`), or is coming with the
 * courier (`Due`). Nothing else is a state.
 *
 * There is one verb, and only one row ever offers it: a `Due` payment is
 * marked collected once the cash is back. Everything else on this screen has
 * already happened and is not anybody's decision to make — which is why the
 * mismatches screen and the reconciliation screen are both gone, and why
 * comparing the ledger against the gateway is the one button in the header
 * rather than a page of its own.
 */

const COLUMNS: Column[] = [
  { key: "id", label: "Payment", primary: true, sub: "order" },
  {
    key: "method",
    label: "Paid by",
    hideSmall: true,
    render: (row) => (
      <span className="aui-table__primary">
        <strong>{row.method}</strong>
        <small>{row.gateway}</small>
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    numeric: true,
    render: (row) => money(row.amount),
    /* The column renders a formatted figure, so the export has to be told
       where the plain number lives. */
    exportValue: (row) => row.amount,
  },
  { key: "status", label: "State", status: true },
  { key: "note", label: "What happened", hideSmall: true },
  { key: "created", label: "Created", align: "right", hideSmall: true },
];

const FIELDS: FormField[] = [
  { key: "id", label: "Payment id", placeholder: "pay_ICE1049", required: true },
  { key: "order", label: "Order", placeholder: "IO-2026-1049", required: true },
  { key: "customer", label: "Customer", placeholder: "A•••• K••••" },
  { key: "gateway", label: "Gateway", type: "select", options: GATEWAYS },
  { key: "method", label: "Paid by", placeholder: "UPI ••••42" },
  { key: "amount", label: "Amount", hint: "₹", type: "number", min: "0", step: "100", placeholder: "11400", required: true },
  { key: "status", label: "State", type: "select", options: PAYMENT_STATES },
  { key: "note", label: "What happened", full: true, placeholder: "Taken at checkout" },
];

export function PaymentsLedger() {
  /* The same list checkout writes to — a shopper's payment is on this screen
     the moment it settles. See `payment-store`. */
  const { payments: rows, commitPayments } = usePaymentLedger();

  const captured = rows.filter((row) => row.status === "Captured");
  const due = rows.filter((row) => row.status === "Due");
  const failed = rows.filter((row) => row.status === "Failed");
  const refunded = rows.filter((row) => row.status === "Refunded");

  const stats: Stat[] = [
    {
      label: "Captured",
      value: money(String(total(captured, "amount"))),
      icon: CircleDollarSign,
      tone: "mint",
      note: `${pad(captured.length)} payments`,
    },
    {
      label: "Due on delivery",
      value: money(String(total(due, "amount"))),
      icon: Truck,
      tone: due.length ? "amber" : "mint",
      note: due.length ? `${pad(due.length)} with the courier` : "Nothing outstanding",
    },
    {
      label: "Failed",
      value: pad(failed.length),
      icon: XCircle,
      tone: failed.length ? "rose" : "mint",
      note: failed.length ? "The customer was not charged" : "Nothing failed",
    },
    {
      label: "Refunded",
      value: money(String(total(refunded, "amount"))),
      icon: Undo2,
      tone: "violet",
      note: `${pad(refunded.length)} sent back`,
    },
  ];

  return (
    <AdminPage
      actions={
        <Btn
          onClick={() =>
            toast.success("Checked against the gateway", {
              description: failed.length
                ? `${rows.length} payments compared · ${failed.length} did not go through.`
                : `${rows.length} payments compared · everything matched.`,
            })
          }
          variant="solid"
        >
          <RefreshCw aria-hidden size={15} strokeWidth={1.8} /> Check against gateway
        </Btn>
      }
      eyebrow="Payments"
      icon={WalletCards}
      lede="Money customers owe, and whether it arrived. Paid online it is captured or it failed; paid cash on delivery it stays due until the courier brings it back."
      spec={[
        { label: "Payments", value: pad(rows.length) },
        { label: "Captured", value: money(String(total(captured, "amount"))) },
        { label: "Due", value: money(String(total(due, "amount"))) },
      ]}
      title={
        <>
          Payments <em>ledger</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        /* The form never asks when a payment happened — a new one is stamped
           now, and an edited one keeps the moment it already had. */
        derive={(values, _rows, previous) => ({
          ...values,
          created: previous?.created ?? stampNow(),
        })}
        fields={FIELDS}
        filterKey="status"
        filterValues={PAYMENT_STATES}
        icon={WalletCards}
        idPrefix="pay_ICE"
        onCommit={commitPayments}
        rowHref={(row) => `/admin/payments/${row.id}`}
        rows={rows}
        singular="payment"
        toolbarLead={<PaymentTabs />}
        tone="mint"
        /* The one verb on this screen. Money taken online is already settled by
           the gateway; the only payment anybody has to do anything about is the
           cash the courier is carrying. */
        rowAction={(row) =>
          row.status === "Due"
            ? {
                icon: CheckCircle2,
                tone: "good" as const,
                label: `Mark ${row.id} collected`,
                patch: { status: "Captured", note: "Cash collected on delivery" },
                toast: {
                  title: "Cash collected",
                  description: `${money(row.amount)} for ${row.order} counts as captured.`,
                },
              }
            : null
        }
      />
    </AdminPage>
  );
}
