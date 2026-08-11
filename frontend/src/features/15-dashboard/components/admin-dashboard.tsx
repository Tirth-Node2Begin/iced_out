import { Activity, AlertTriangle, ArrowRight, Banknote, Boxes, Clock3, PackageCheck, RotateCcw, ShoppingBag, Zap } from "lucide-react";
import Link from "next/link";

const queueCards = [
  { label: "Orders to confirm", value: "12", note: "3 older than 20 min", href: "/admin/orders", icon: ShoppingBag },
  { label: "Ready to pack", value: "08", note: "Next pickup at 18:00", href: "/admin/fulfilment/pack", icon: PackageCheck },
  { label: "Returns for QC", value: "05", note: "2 arriving today", href: "/admin/returns/qc", icon: RotateCcw },
  { label: "Payment exceptions", value: "02", note: "Both inside SLA", href: "/admin/payments/mismatches", icon: Banknote },
  { label: "Low stock variants", value: "17", note: "6 in current drop", href: "/admin/inventory/overview", icon: Boxes },
];

export function AdminDashboard() {
  return (
    <section className="admin-workspace">
      <div className="admin-heading"><p>Operations / Today</p><h1>Clear the queues.</h1><span>Every metric leads to the work behind it. Net revenue is the default financial view.</span></div>
      <div className="admin-command-center">
        <div><p><span className="status-dot" /> Live operations</p><strong>48</strong><small>orders moved through the system today</small><div className="admin-throughput-bars" aria-label="Hourly throughput"><i style={{ height: "32%" }} /><i style={{ height: "48%" }} /><i style={{ height: "38%" }} /><i style={{ height: "72%" }} /><i style={{ height: "58%" }} /><i style={{ height: "86%" }} /><i style={{ height: "68%" }} /><i style={{ height: "94%" }} /><i style={{ height: "76%" }} /><i style={{ height: "88%" }} /></div></div>
        <div className="admin-shift-signal"><Zap size={20} /><p><span>Current shift</span><strong>All critical lanes staffed</strong><small><Clock3 size={12} /> Pickup cut-off in 03h 20m</small></p></div>
        <div className="admin-health-ring"><Activity size={18} /><strong>94</strong><span>Ops health</span><small>4 systems nominal</small></div>
      </div>
      <div className="admin-stat-grid">
        <article><span>Net revenue today</span><strong>₹4,28,420</strong><p>+12.4% against last Tuesday</p></article>
        <article><span>Orders placed</span><strong>48</strong><p>₹8,925 average order value</p></article>
        <article><span>Conversion</span><strong>3.84%</strong><p>1,249 qualified sessions</p></article>
        <article><span>Return rate · 30d</span><strong>11.2%</strong><p>Fit is the leading reason</p></article>
      </div>
      <div className="admin-section-title"><div><h2>Action queues</h2><p>Oldest and highest-risk work appears first.</p></div><span className="admin-freshness"><span className="status-dot" /> Fresh · 14:40 IST</span></div>
      <div className="admin-dashboard-queues">
        {queueCards.map(({ label, value, note, href, icon: Icon }) => (
          <Link href={href} key={label}><Icon size={20} /><span>{label}</span><strong>{value}</strong><small>{note}</small><ArrowRight size={16} /></Link>
        ))}
      </div>
      <div className="admin-alert"><AlertTriangle size={20} /><div><strong>Razorpay webhooks delayed by 42 seconds</strong><p>Reconciliation polling is active. No customer action is required.</p></div></div>
    </section>
  );
}
