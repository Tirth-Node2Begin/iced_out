import { AlertTriangle, ArrowRight, CheckCircle2, Download, RefreshCw, Search } from "lucide-react";
import Link from "next/link";

import { paymentRefunds, paymentTransactions, reconciliationCases, settlements } from "@/features/09-payment/payment-data";

export type PaymentView =
  | "overview"
  | "transactions"
  | "transaction-detail"
  | "refunds"
  | "refund-detail"
  | "mismatches"
  | "reconciliation"
  | "settlements"
  | "settlement-detail";

function Status({ value }: { value: string }) {
  return <span className={`admin-status admin-status--${value.toLowerCase()}`}>{value}</span>;
}

function Heading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="admin-heading"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>;
}

function TransactionTable() {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Payment</th><th>Order</th><th>Customer</th><th>Gateway / method</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>{paymentTransactions.map((payment) => (
          <tr key={payment.id}>
            <td><Link href={`/admin/payments/transactions/${payment.id}`}>{payment.id}</Link></td><td>{payment.order}</td><td>{payment.customer}</td><td>{payment.gateway}<small>{payment.method}</small></td><td>{payment.amount}</td><td><Status value={payment.status} /></td><td>{payment.created}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function PaymentWorkspace({ view, recordId }: { view: PaymentView; recordId?: string }) {
  if (view === "transactions") return <section className="admin-workspace"><Heading eyebrow="Payments / Ledger" title="Transactions" copy="Search and inspect every gateway attempt without exposing raw payment credentials." /><div className="admin-toolbar"><label><Search size={16} /><input aria-label="Search transactions" placeholder="Payment, order, gateway reference" /></label><button><Download size={16} /> Export masked CSV</button></div><TransactionTable /></section>;

  if (view === "transaction-detail") {
    const payment = paymentTransactions.find((item) => item.id === recordId) ?? paymentTransactions[0];
    return <section className="admin-workspace"><Heading eyebrow="Transaction detail" title={payment.id} copy="Gateway evidence, order link, attempts, reconciliation, and immutable audit history." /><div className="admin-detail-grid"><article><h2>Payment</h2><dl><div><dt>Status</dt><dd><Status value={payment.status} /></dd></div><div><dt>Order</dt><dd>{payment.order}</dd></div><div><dt>Amount</dt><dd>{payment.amount}</dd></div><div><dt>Gateway</dt><dd>{payment.gateway}</dd></div><div><dt>Method</dt><dd>{payment.method}</dd></div><div><dt>Gateway reference</dt><dd>gwy_••••1048</dd></div></dl></article><article><h2>Verification timeline</h2><ol className="admin-timeline"><li><CheckCircle2 size={17} /><div><strong>Signature verified</strong><span>04 Aug · 14:32:08</span></div></li><li><CheckCircle2 size={17} /><div><strong>Amount matched order</strong><span>04 Aug · 14:32:09</span></div></li><li><RefreshCw size={17} /><div><strong>Settlement pending</strong><span>Expected T+2</span></div></li></ol></article></div><div className="admin-action-bar"><p>Dangerous actions require <code>payments.refunds.approve</code> and a reason.</p><Link href="/admin/payments/refunds">Open refund workflow <ArrowRight size={16} /></Link></div></section>;
  }

  if (view === "refunds") return <section className="admin-workspace"><Heading eyebrow="Payments / Returns" title="Refunds" copy="Monitor requested, approved, processing, succeeded, and failed refunds." /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Refund</th><th>Payment</th><th>Order</th><th>Amount</th><th>Reason</th><th>Status</th></tr></thead><tbody>{paymentRefunds.map((refund) => <tr key={refund.id}><td><Link href={`/admin/payments/refunds/${refund.id}`}>{refund.id}</Link></td><td>{refund.payment}</td><td>{refund.order}</td><td>{refund.amount}</td><td>{refund.reason}</td><td><Status value={refund.status} /></td></tr>)}</tbody></table></div></section>;

  if (view === "refund-detail") {
    const refund = paymentRefunds.find((item) => item.id === recordId) ?? paymentRefunds[0];
    return <section className="admin-workspace"><Heading eyebrow="Refund detail" title={refund.id} copy="Refund evidence is append-only and remains linked to payment, order, and settlement." /><div className="admin-detail-grid"><article><h2>Refund</h2><dl><div><dt>Status</dt><dd><Status value={refund.status} /></dd></div><div><dt>Payment</dt><dd>{refund.payment}</dd></div><div><dt>Order</dt><dd>{refund.order}</dd></div><div><dt>Amount</dt><dd>{refund.amount}</dd></div><div><dt>Reason</dt><dd>{refund.reason}</dd></div></dl></article><article><h2>Controls</h2><p>Retry is enabled only after a gateway failure. Approvals require separation of duties and create an audit event.</p><button className="admin-primary" type="button" disabled>Retry unavailable</button></article></div></section>;
  }

  if (view === "mismatches") return <section className="admin-workspace"><Heading eyebrow="Payments / Exceptions" title="Mismatches" copy="Resolve amount, state, webhook, and settlement drift before an order advances." /><div className="admin-alert"><AlertTriangle size={20} /><div><strong>{reconciliationCases.length} cases need review</strong><p>Order confirmation remains blocked for unresolved amount mismatches.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Case</th><th>Payment</th><th>Expected</th><th>Gateway received</th><th>Issue</th><th>Age</th></tr></thead><tbody>{reconciliationCases.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.payment}</td><td>{item.expected}</td><td>{item.received}</td><td><Status value="Review" /> {item.issue}</td><td>{item.age}</td></tr>)}</tbody></table></div></section>;

  if (view === "reconciliation") return <section className="admin-workspace"><Heading eyebrow="Payments / Controls" title="Reconciliation" copy="Compare internal ledgers with gateway transactions and settlement files." /><div className="admin-stat-grid"><article><span>Last automated run</span><strong>14:35 IST</strong><p>1,248 rows checked</p></article><article><span>Matched</span><strong>99.84%</strong><p>1,246 exact matches</p></article><article><span>Open exceptions</span><strong>02</strong><p>Both inside SLA</p></article></div><div className="admin-detail-grid"><article><h2>Run reconciliation</h2><p>Poll current gateway states and compare amount, currency, order, refund, and settlement references.</p><button className="admin-primary" type="button"><RefreshCw size={16} /> Run now</button></article><article><h2>Import settlement file</h2><p>CSV files are parsed in quarantine and must match the configured gateway schema.</p><button type="button"><Download size={16} /> Select signed CSV</button></article></div></section>;

  if (view === "settlements") return <section className="admin-workspace"><Heading eyebrow="Payments / Payouts" title="Settlements" copy="Match gateway payouts to captured payments, refunds, fees, taxes, and net bank deposits." /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Settlement</th><th>Gateway</th><th>Period</th><th>Gross</th><th>Fees</th><th>Net payout</th><th>Status</th></tr></thead><tbody>{settlements.map((item) => <tr key={item.id}><td><Link href={`/admin/payments/settlements/${item.id}`}>{item.id}</Link></td><td>{item.gateway}</td><td>{item.period}</td><td>{item.gross}</td><td>{item.fees}</td><td>{item.net}</td><td><Status value={item.status} /></td></tr>)}</tbody></table></div></section>;

  if (view === "settlement-detail") {
    const settlement = settlements.find((item) => item.id === recordId) ?? settlements[0];
    return <section className="admin-workspace"><Heading eyebrow="Settlement detail" title={settlement.id} copy="Payout arithmetic with line-level traceability to payments and refunds." /><div className="admin-stat-grid"><article><span>Gross captured</span><strong>{settlement.gross}</strong><p>{settlement.period}</p></article><article><span>Gateway fees</span><strong>{settlement.fees}</strong><p>Tax included</p></article><article><span>Net payout</span><strong>{settlement.net}</strong><p><Status value={settlement.status} /></p></article></div><TransactionTable /></section>;
  }

  return <section className="admin-workspace"><Heading eyebrow="Admin / Payment operations" title="Payments" copy="One operational view for money collected, refunded, reconciled, and settled." /><div className="admin-stat-grid"><article><span>Captured today</span><strong>₹4,82,600</strong><p>48 successful payments</p></article><article><span>Refunds processing</span><strong>₹13,500</strong><p>2 inside gateway SLA</p></article><article><span>Needs review</span><strong>02</strong><p>Confirmation blocked safely</p></article><article><span>Next payout</span><strong>₹2,78,908</strong><p>Expected 06 Aug</p></article></div><div className="admin-section-title"><div><h2>Recent transactions</h2><p>Newest gateway attempts and their verified state.</p></div><Link href="/admin/payments/transactions">View ledger <ArrowRight size={16} /></Link></div><TransactionTable /></section>;
}
