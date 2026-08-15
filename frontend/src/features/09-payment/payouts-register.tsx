"use client";

import { Banknote, CheckCircle2, Landmark, Scale } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage } from "@/components/admin/admin-ui";
import { RecordManager, type Column, type FormField } from "@/components/admin/record-manager";
import {
  GATEWAYS,
  PAYOUT_STATES,
  money,
  pad,
  total,
} from "@/features/09-payment/payment-data";
import { usePaymentLedger } from "@/features/09-payment/payment-store";
import { PaymentTabs } from "@/features/09-payment/payment-tabs";

/**
 * Payouts — what the gateway actually deposited in the bank.
 *
 * The arithmetic is the whole screen: gross captured, minus the gateway's
 * fees, is the net that lands. The form asks for the first two and works out
 * the third, so a payout on this register can never disagree with itself.
 *
 * A payout is `Pending` until someone sees it in the bank statement and says
 * so. Nothing here reconciles itself.
 */

const COLUMNS: Column[] = [
  { key: "id", label: "Payout", primary: true, sub: "gateway" },
  { key: "period", label: "Period", hideSmall: true },
  {
    key: "gross",
    label: "Gross",
    align: "right",
    numeric: true,
    hideSmall: true,
    render: (row) => money(row.gross),
    exportValue: (row) => row.gross,
  },
  {
    key: "fees",
    label: "Fees",
    align: "right",
    numeric: true,
    hideSmall: true,
    render: (row) => money(row.fees),
    exportValue: (row) => row.fees,
  },
  {
    key: "net",
    label: "Net to bank",
    align: "right",
    numeric: true,
    render: (row) => money(row.net),
    exportValue: (row) => row.net,
  },
  { key: "status", label: "State", status: true },
];

/* No `net` field: it is gross minus fees, and a number you can derive is a
   number nobody should be able to mistype. */
const FIELDS: FormField[] = [
  { key: "id", label: "Payout id", placeholder: "out_ICE085", required: true },
  { key: "gateway", label: "Gateway", type: "select", options: GATEWAYS },
  { key: "period", label: "Period", placeholder: "05–06 Aug 2026" },
  { key: "gross", label: "Gross captured", hint: "₹", type: "number", min: "0", step: "1000", placeholder: "284600", required: true },
  { key: "fees", label: "Gateway fees", hint: "₹", type: "number", min: "0", step: "100", placeholder: "5692" },
  { key: "status", label: "State", type: "select", options: PAYOUT_STATES },
];

export function PayoutsRegister() {
  const { payouts: rows, commitPayouts } = usePaymentLedger();

  const pending = rows.filter((row) => row.status === "Pending");
  const paid = rows.filter((row) => row.status === "Paid");

  const stats: Stat[] = [
    {
      label: "On its way",
      value: money(String(total(pending, "net"))),
      icon: Banknote,
      tone: "sky",
      note: `${pad(pending.length)} payouts pending`,
    },
    {
      label: "In the bank",
      value: money(String(total(paid, "net"))),
      icon: Landmark,
      tone: "mint",
      note: `${pad(paid.length)} confirmed`,
    },
    {
      label: "Gateway fees",
      value: money(String(total(rows, "fees"))),
      icon: Scale,
      tone: "amber",
      note: "Deducted before payout",
    },
  ];

  return (
    <AdminPage
      eyebrow="Payments · Payouts"
      icon={Banknote}
      lede="What the gateway deposits, and what it kept. Net is gross minus fees — mark a payout paid once it shows up on the bank statement."
      spec={[
        { label: "Payouts", value: pad(rows.length) },
        { label: "Pending", value: money(String(total(pending, "net"))) },
        { label: "Fees", value: money(String(total(rows, "fees"))) },
      ]}
      title={
        <>
          Gateway <em>payouts</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        /* The one sum on this screen, done in one place. */
        derive={(values) => ({
          ...values,
          net: String(Math.max(0, (Number(values.gross) || 0) - (Number(values.fees) || 0))),
        })}
        fields={FIELDS}
        filterKey="status"
        filterValues={PAYOUT_STATES}
        icon={Banknote}
        idPrefix="out_ICE"
        onCommit={commitPayouts}
        rows={rows}
        singular="payout"
        toolbarLead={<PaymentTabs />}
        tone="violet"
        rowAction={(row) =>
          row.status === "Pending"
            ? {
                icon: CheckCircle2,
                tone: "good" as const,
                label: `Mark ${row.id} paid`,
                patch: { status: "Paid" },
                toast: {
                  title: "Payout confirmed",
                  description: `${money(row.net)} is in the bank.`,
                },
              }
            : null
        }
      />
    </AdminPage>
  );
}
