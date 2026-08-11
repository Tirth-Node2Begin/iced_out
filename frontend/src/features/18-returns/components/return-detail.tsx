import { Check, Circle, RotateCcw } from "lucide-react";

import { AccountSection } from "@/components/account/account-section";
import type { ReturnFixture } from "@/features/18-returns/data/return-fixtures";

export function ReturnDetail({ item }: { item: ReturnFixture }) {
  const completed = item.status === "Refund complete";
  return <AccountSection eyebrow="Return / Reverse logistics" title={item.id.toUpperCase()} copy={`${item.item} · ${item.variant}`}><div className="account-detail-grid"><article><RotateCcw size={18} /><h2>Return facts</h2><dl><div><dt>Order</dt><dd>{item.order}</dd></div><div><dt>Outcome</dt><dd>{item.outcome}</dd></div><div><dt>Amount</dt><dd>{item.amount}</dd></div><div><dt>Destination</dt><dd>{item.destination}</dd></div></dl></article><article><p className="eyebrow">Provider reference</p><h2>Safe to share with support.</h2><p>Provider completion remains authoritative; the UI only displays its masked projection.</p><strong className="account-reference">{item.reference}</strong></article></div><div className="account-order-timeline"><div className="is-complete"><Check size={15} /><p><strong>Request approved</strong><small>Eligibility and evidence accepted</small></p></div><div className="is-complete"><Check size={15} /><p><strong>Pickup and QC</strong><small>{completed ? "Item received and passed QC" : "Pickup scheduled · QC follows receipt"}</small></p></div><div className={completed ? "is-complete" : ""}>{completed ? <Check size={15} /> : <Circle size={15} />}<p><strong>{completed ? "Refund complete" : "Refund after QC"}</strong><small>{completed ? `${item.amount} returned to ${item.destination}` : "Expected within 5–7 business days after approval"}</small></p></div></div></AccountSection>;
}
