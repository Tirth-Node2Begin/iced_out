"use client";

import { Banknote, CheckCircle2, Landmark, Scale } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage } from "@/components/admin/admin-ui";
import { RecordManager, type Column } from "@/components/admin/record-manager";
import { PAYOUT_STATES, money, pad, total } from "@/features/09-payment/payment-data";
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

export function PayoutsRegister() {
  /**
   * A payout is what the GATEWAY settled to the bank. Nobody at the shop creates
   * one, which is why there is no form here any more — it had editable gross and
   * fee amounts, which is a form for inventing a bank statement. The one verb is
   * confirming that the money arrived.
   */
  const { payouts: rows, ready, loading, error, act } = usePaymentLedger();

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
        emptyHint="No payouts yet. They appear as the gateway settles captured payments to the bank."
        error={error}
        /* `net` is derived by the server — max(0, gross − fees) — so the column
           cannot drift from the two figures it comes from. */
        fields={[]}
        filterKey="status"
        filterValues={PAYOUT_STATES}
        icon={Banknote}
        loaded={ready}
        loading={loading}
        readOnly
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
                onSelect: () => act(`/admin/payouts/${encodeURIComponent(row.id)}/mark-paid`),
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
