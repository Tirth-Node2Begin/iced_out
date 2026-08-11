import { ArrowRight, EyeOff, Search, ShieldCheck, ShoppingBag, Ticket } from "lucide-react";
import Link from "next/link";

const customers = [
  { id: "cus-2048", name: "A•••• K••••", contact: "aa•••@example.com", orders: 4, value: "₹42,600", state: "Active", context: "Order in fulfilment" },
  { id: "cus-2047", name: "R•••• S••••", contact: "ri•••@example.com", orders: 2, value: "₹17,800", state: "Support", context: "Payment ticket open" },
  { id: "cus-2031", name: "M•••• P••••", contact: "ma•••@example.com", orders: 7, value: "₹81,400", state: "Active", context: "No open actions" },
];

export function AdminCustomersWorkspace() {
  return <section className="admin-workspace"><div className="admin-heading"><p>Customers / Masked by default</p><h1>Customer context</h1><span>Commerce history without casual PII exposure. Unmasking requires a narrower permission, reason, and audit event.</span></div><div className="customer-safety"><ShieldCheck size={20} /><div><strong>Field masking is active</strong><p>Email, mobile, address, and payment references are projected for this role.</p></div><span><EyeOff size={15} /> PII hidden</span></div><div className="admin-toolbar"><label><Search size={16} /><input aria-label="Search customers" placeholder="Masked name, order, ticket" /></label><button type="button">Saved view · Active value</button></div><div className="customer-records">{customers.map((customer) => <article key={customer.id}><span className="customer-avatar">{customer.name.slice(0, 1)}</span><div><small>{customer.id}</small><h2>{customer.name}</h2><p>{customer.contact}</p></div><div><ShoppingBag size={15} /><span>Orders</span><strong>{customer.orders}</strong></div><div><span>Lifetime value</span><strong>{customer.value}</strong></div><div><Ticket size={15} /><span>{customer.state}</span><small>{customer.context}</small></div><Link href={`/admin/customers/${customer.id}`} aria-label={`Open ${customer.id}`}><ArrowRight size={16} /></Link></article>)}</div></section>;
}
