"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CreditCard,
  Image as ImageIcon,
  RotateCcw,
  Ticket,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import {
  AdminPage,
  Btn,
  DetailList,
  Field,
  Note,
  Panel,
  Section,
  Status,
  Timeline,
} from "@/components/admin/admin-ui";
import { formatPrice } from "@/features/02-products/utils/format-price";
import {
  AWAITING_PAYMENT,
  EXCHANGE,
  adminReturnFixtures,
} from "@/features/18-returns/data/admin-return-fixtures";
import { useReturnsRegister } from "@/features/18-returns/data/returns-store";
import { balanceOf, replacementPrice } from "@/features/18-returns/utils/exchange";

const ELIGIBILITY = [
  "Delivered inside the return window",
  "Item and quantity belong to the customer's order",
  "Product is not a final-sale exception",
  "Requested amount matches the frozen order arithmetic",
];

/**
 * One return, and the three decisions available on it: approve the pickup,
 * ask for more evidence, or reject with a policy reason. The evidence that
 * supports each of those sits above them rather than behind a tab.
 */
export function AdminReturnDetail({ returnId }: { returnId: string }) {
  const { returns, patch } = useReturnsRegister();

  /* The register, not the fixtures. A decision taken on the list has to be the
     one this page shows, and a decision taken here has to be the one the list
     shows when you go back — which is only true if there is one copy of the
     record and both screens are reading it. */
  const record = returns.find((entry) => entry.id === returnId) ?? returns[0] ?? adminReturnFixtures[0];
  const decision = record.state;

  /* An exchange is the only outcome with a second item and a second price
     behind it, so it is the only one that gets a block of its own below. */
  const swap = record.outcome === EXCHANGE && Boolean(record.replacement);
  const balance = swap ? balanceOf(record.amount, record.replacement) : null;

  /* A pricier replacement is the one case where approving does not finish the
     decision: the difference is asked for in the same press, and the return
     waits on the customer rather than on anyone here. */
  const collects = balance?.direction === "collect";

  /* `Awaiting payment` is an approved return that is waiting on money, so every
     step the approval unlocks reads as done from it too. */
  const approved = decision === "Approved" || decision === AWAITING_PAYMENT;

  const rail: Stat[] = [
    { label: "Customer", value: record.customer, icon: UserRound, tone: "sky", note: "02 orders · no prior returns" },
    { label: "Asked for", value: record.outcome, icon: ArrowLeftRight, tone: "violet", note: swap ? record.replacement : record.reason },
    { label: "Reverse pickup", value: "06 Aug", icon: Truck, tone: "amber", note: "10:00–14:00 · AWB ••••9072" },
    balance
      ? { label: balance.label, value: balance.short, icon: CreditCard, tone: balance.direction === "collect" ? "amber" : "mint", note: balance.direction === "collect" ? "Taken before it ships" : "Added to their account" }
      : { label: "Settles as", value: formatPrice(Number(record.amount) || 0), icon: Ticket, tone: "mint", note: "Voucher onto their account" },
  ];

  return (
    <AdminPage
      actions={
        <>
          <Btn
            onClick={() => {
              patch(record.id, { state: collects ? AWAITING_PAYMENT : "Approved" });
              toast.success(collects ? `${balance?.amount} requested` : "Pickup approved", {
                description: balance
                  ? `${record.id} scheduled for 06 Aug · ${record.replacement} reserved. ${balance.sentence}`
                  : `${record.id} scheduled for 06 Aug.`,
              });
            }}
            variant="solid"
          >
            <Check aria-hidden size={15} strokeWidth={1.9} /> Approve pickup
          </Btn>
          <Btn onClick={() => toast.info("Evidence requested", { description: "The customer was asked for two more photographs." })}>
            <ImageIcon aria-hidden size={15} strokeWidth={1.7} /> Request evidence
          </Btn>
          <Btn
            onClick={() => {
              patch(record.id, { state: "Rejected" });
              toast.error("Return rejected", { description: `${record.id} was closed with a policy reason.` });
            }}
            variant="danger"
          >
            <X aria-hidden size={15} strokeWidth={1.9} /> Reject
          </Btn>
        </>
      }
      back={{
        href: swap ? "/admin/returns/exchanges" : "/admin/returns/requests",
        label: swap ? "Exchanges" : "Returns",
      }}
      eyebrow={`Returns & Exchanges · ${swap ? "Exchange" : "Return"} detail`}
      icon={RotateCcw}
      lede={`${record.order} · ${record.item}. Everything behind this one request: whether it qualifies, what the customer sent as proof, and where it has got to.`}
      spec={[
        { label: "Status", value: decision },
        { label: "Asked for", value: record.outcome },
        { label: "Photos", value: "02" },
      ]}
      title={
        <>
          Return <em>{record.id}</em>
        </>
      }
    >
      <StatGrid stats={rail} />

      {balance && (
        <Section
          actions={<Status tone={balance.direction === "collect" ? "warn" : "good"} value={`${balance.label} · ${balance.short}`} />}
          copy="The swap, priced. What comes back is valued at what the customer paid for it; what goes out is priced at what it sells for today."
          eyebrow="Exchange"
          title="What goes out instead"
        >
          <Panel>
            <div style={{ display: "grid", gap: 14 }}>
              <DetailList
                rows={[
                  { label: "Coming back", value: `${record.item} · ${formatPrice(Number(record.amount) || 0)}` },
                  { label: "Going out", value: `${record.replacement} · ${formatPrice(replacementPrice(record.replacement))}` },
                  { label: "Difference", value: balance.short },
                ]}
              />
              <Note icon={ArrowLeftRight}>{balance.sentence}</Note>
            </div>
          </Panel>
        </Section>
      )}

      <div className="aui-grid aui-grid--2">
        <Section
          actions={<Status tone="good" value="All checks passed" />}
          copy="Automatic policy checks run when the request is created. All four must pass before a pickup can be approved."
          eyebrow="Eligibility"
          title="Policy checks"
        >
          <Panel>
            <DetailList
              rows={ELIGIBILITY.map((text) => ({
                label: text,
                value: <Check aria-label="Passed" size={15} style={{ color: "var(--aui-mint)" }} />,
              }))}
            />
          </Panel>
        </Section>

        <Section
          copy="Approval, rejection and evidence requests all write an audit event naming the reason."
          eyebrow="Decision"
          title="Record your reason"
        >
          <Panel>
            <div style={{ display: "grid", gap: 14 }}>
              <Field help="Stored with the decision and visible to the customer on rejection." label="Decision reason">
                <textarea
                  defaultValue="Eligible request; condition to be confirmed when the item arrives."
                  rows={4}
                />
              </Field>
              <Note icon={AlertTriangle} tone="warn">
                {collects
                  ? `Approving here arranges the pickup, holds ${record.replacement}, and asks ${record.customer} for the ${balance?.amount} difference in the same press. It ships once that is paid — you never work the figure out or raise it yourself.`
                  : balance
                    ? `Approving here arranges the pickup and holds ${record.replacement}. ${balance.sentence} Nothing moves until the item is back and you send the replacement from the exchanges list.`
                    : "Approving here only arranges the pickup. No money moves until the item is back and you settle the return on the returns list, which issues the voucher for you."}
              </Note>
            </div>
          </Panel>
        </Section>
      </div>

      <Section copy="Where this request is, and what happens next." eyebrow="Progress" title="Return timeline">
        <Panel>
          <Timeline
            steps={[
              { title: "Request created", detail: "04 Aug · 12:18 · by the customer", done: true },
              {
                title: decision === "Rejected" ? "Rejected with reason" : "Approval",
                detail: approved
                  ? "Approved · pickup scheduled 06 Aug"
                  : decision === "Rejected"
                    ? "Closed · policy reason recorded"
                    : "Manager queue · waiting 46 min",
                done: approved || decision === "Rejected",
              },
              /* Only a swap that costs more has this step at all, and nobody
                 put it there — the price difference did. */
              ...(collects
                ? [
                    {
                      title: `${balance?.amount} collected from the customer`,
                      detail: approved
                        ? "Payment link sent on approval · waiting on the customer"
                        : "Raised automatically when this is approved",
                      done: false,
                    },
                  ]
                : []),
              {
                title: "Pickup",
                detail: approved ? "AWB ••••9072 · 06 Aug 10:00–14:00" : "Begins after approval",
                done: false,
              },
              {
                title: balance ? `${record.replacement} sent` : "Voucher issued",
                detail: balance
                  ? `Once the item is back · ${balance.label.toLowerCase()} ${balance.short}`
                  : `Once the item is back · ${formatPrice(Number(record.amount) || 0)} onto their account`,
                done: false,
              },
            ]}
          />
        </Panel>
      </Section>

      <Section copy="Sent by the customer with the request. Scanned before anyone can open them." eyebrow="Evidence" title="02 photos">
        <div className="aui-grid aui-grid--2">
          {["Photo 01", "Photo 02"].map((label) => (
            <Panel key={label}>
              <div style={{ display: "grid", gap: 10, justifyItems: "center", padding: "18px 0" }}>
                <span className="aui-empty__glyph">
                  <ImageIcon aria-hidden size={19} strokeWidth={1.5} />
                </span>
                <strong style={{ fontSize: 13, fontWeight: 500 }}>{label}</strong>
                <small style={{ color: "var(--nh-muted)", fontSize: 11.5 }}>Being scanned · not yet shown</small>
              </div>
            </Panel>
          ))}
        </div>
      </Section>
    </AdminPage>
  );
}
