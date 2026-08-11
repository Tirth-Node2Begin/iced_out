"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Filter, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const orders = [
  { id: "IO-2026-1048", customer: "Aarav K.", pieces: "2 pieces", payment: "Captured", delivery: "Bengaluru · Standard", status: "Confirm", age: "08 min" },
  { id: "IO-2026-1047", customer: "Riya S.", pieces: "1 piece", payment: "Verifying", delivery: "Mumbai · Express", status: "Review", age: "16 min" },
  { id: "IO-2026-1046", customer: "Maya P.", pieces: "3 pieces", payment: "Captured", delivery: "Delhi · Express", status: "Dispatch", age: "42 min" },
];

export function AdminOrdersWorkspace({ initialQueue = "All" }: { initialQueue?: string }) {
  const [queue, setQueue] = useState(initialQueue);
  return <section className="admin-workspace"><div className="admin-heading admin-heading--actions"><div><p>Orders / State machine</p><h1>Orders</h1><span>Payment, fulfilment, shipment, return, and customer context without losing canonical state.</span></div><button className="admin-primary" type="button">Create manual order</button></div><div className="admin-stat-grid"><article><span>Awaiting confirmation</span><strong>12</strong><p>3 older than twenty minutes</p></article><article><span>Ready to fulfil</span><strong>08</strong><p>Next courier cutoff 18:00</p></article><article><span>Payment review</span><strong>02</strong><p>Confirmation safely blocked</p></article><article><span>Dispatch SLA</span><strong>96.4%</strong><p>Rolling seven-day performance</p></article></div><div className="admin-order-pulse"><div><CheckCircle2 size={18} /><span>Paid</span><strong>48</strong></div><i /><div><Clock3 size={18} /><span>Allocate</span><strong>12</strong></div><i /><div><Truck size={18} /><span>Dispatch</span><strong>08</strong></div><i /><div><AlertTriangle size={18} /><span>Exceptions</span><strong>02</strong></div></div><div className="admin-tabs" role="tablist" aria-label="Order queues">{["All", "Confirm", "Review", "Dispatch"].map((item) => <button aria-selected={queue === item} className={queue === item ? "is-active" : ""} onClick={() => setQueue(item)} role="tab" type="button" key={item}>{item}</button>)}</div><div className="admin-toolbar"><label><Search size={16} /><input aria-label="Search orders" placeholder="Order, customer, mobile, SKU" /></label><button type="button"><Filter size={16} /> Filters · {queue}</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Delivery</th><th>Queue age</th><th>State</th><th /></tr></thead><tbody>{orders.filter((order) => queue === "All" || order.status === queue).map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{order.pieces}</small></td><td>{order.customer}<small>PII masked by permission</small></td><td>{order.payment}</td><td>{order.delivery}</td><td>{order.age}</td><td><span className="admin-status admin-status--review">{order.status}</span></td><td><Link aria-label={`Open ${order.id}`} href={`/admin/orders/${order.id}`}><ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div></section>;
}
