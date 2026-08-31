"use client";

/* No state of its own — but the icons it hands the console's UI kit are
   components, and a server component cannot pass one across the boundary. */

import { AlertTriangle, WalletCards } from "lucide-react";

import {
  AdminPage,
  DetailList,
  Empty,
  Note,
  Panel,
  Section,
  Status,
  Timeline,
} from "@/components/shell/admin-ui";
import { money, total } from "@/features/09-payment/payment-data";
import { usePaymentLedger } from "@/features/09-payment/payment-store";

/**
 * One payment: what it was for, what the gateway said, and how far it got.
 *
 * Read-only on purpose. The two decisions a payment ever needs — accept it or
 * fail it — live on its row in the ledger, so there is exactly one place to
 * make them and no way for this screen to disagree with that one.
 *
 * The timeline is read off the record rather than written out, so it can never
 * tell a story about a state the payment is not in.
 */
export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const { payments, refunds } = usePaymentLedger();
  const payment = payments.find((entry) => entry.id === paymentId);

  if (!payment) {
    return (
      <AdminPage
        back={{ href: "/payments", label: "Payments" }}
        eyebrow="Payment"
        icon={WalletCards}
        title={
          <>
            Payment <em>{paymentId}</em>
          </>
        }
      >
        <Empty
          copy="No payment with this reference is in the ledger."
          icon={WalletCards}
          title="Not found"
        />
      </AdminPage>
    );
  }

  /* Everything sent back against this payment — the refunds register is the
     only place that knows, so it is asked rather than duplicated. */
  const reversals = refunds.filter((entry) => entry.payment === payment.id);
  const sentBack = total(reversals, "amount");

  const settled = payment.status === "Captured" || payment.status === "Refunded";

  /* Cash on delivery never went near a gateway, so it is told as what it is —
     an order out with a courier who has the money to bring back. Reusing the
     gateway timeline for it would narrate a signature check that never
     happened. */
  const onDelivery = payment.gateway === "Courier" || payment.method === "Cash on delivery";

  const steps = onDelivery
    ? [
        { title: "Order placed", detail: payment.created, done: true },
        {
          title: "Courier collects the cash",
          detail: settled ? "Collected at the door" : payment.note,
          done: settled,
        },
        {
          title: "Marked collected in the ledger",
          detail: settled ? "Counts as captured" : "Waiting on the courier",
          done: settled,
        },
      ]
    : [
        {
          title: "Payment attempted",
          detail: `${payment.gateway} · ${payment.created}`,
          done: true,
        },
        {
          title: "Gateway signature verified",
          detail:
            payment.status === "Failed"
              ? "The attempt was declined before this step"
              : "Checked by the server against the gateway key",
          done: payment.status !== "Failed",
        },
        {
          title: "Amount matched the order",
          detail: payment.note,
          done: settled,
        },
      ];

  return (
    <AdminPage
      back={{ href: "/payments", label: "Payments" }}
      eyebrow="Payment"
      icon={WalletCards}
      lede="Gateway evidence and the order it paid for. Card and account numbers are never held here — only the masked method the customer used."
      spec={[
        { label: "Amount", value: money(payment.amount) },
        { label: "State", value: payment.status },
        { label: "Gateway", value: payment.gateway },
      ]}
      title={
        <>
          Payment <em>{payment.id}</em>
        </>
      }
    >
      <div className="aui-grid aui-grid--2">
        <Section
          actions={<Status value={payment.status} />}
          copy="What the gateway confirmed, and what it was for."
          eyebrow="Record"
          title="Payment facts"
        >
          <Panel>
            <DetailList
              rows={[
                { label: "Order", value: payment.order },
                { label: "Customer", value: payment.customer },
                { label: "Amount", value: money(payment.amount) },
                { label: "Gateway", value: payment.gateway },
                { label: "Paid by", value: payment.method },
                ...(payment.reference ? [{ label: "Gateway reference", value: payment.reference }] : []),
                { label: "Created", value: payment.created },
                ...(sentBack > 0
                  ? [{ label: "Sent back", value: `${money(String(sentBack))} · ${reversals.length} refund${reversals.length === 1 ? "" : "s"}` }]
                  : []),
              ]}
            />
          </Panel>
        </Section>

        <Section
          copy="Each step is recorded by the server as it happens."
          eyebrow="History"
          title="What happened"
        >
          <Panel>
            <Timeline steps={steps} />
          </Panel>
        </Section>
      </div>

      {payment.status === "Due" && (
        <Note icon={AlertTriangle} tone="warn" title="This money is not in yet">
          {payment.note}. Mark it collected from the ledger once the cash is back — until then it
          counts against nothing, and no payout can cover it.
        </Note>
      )}

      {payment.status === "Failed" && (
        <Note icon={AlertTriangle} tone="warn" title="Nothing was taken from the customer">
          {payment.note}. The order is recorded as unpaid, and a second attempt lands here as its
          own row rather than overwriting this one.
        </Note>
      )}

    </AdminPage>
  );
}
