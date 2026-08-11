"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BellRing,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  Command,
  FileText,
  Gauge,
  Headphones,
  KeyRound,
  LogOut,
  Megaphone,
  PackageCheck,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Truck,
  Undo2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/features/20-auth-security/auth-context";

const navigation = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view", icon: Gauge },
  { href: "/admin/orders", label: "Orders", permission: "orders.view", icon: ShoppingBag },
  { href: "/admin/fulfilment/pick", label: "Fulfilment", permission: "fulfilment.view", icon: PackageCheck },
  { href: "/admin/shipments/active", label: "Shipments", permission: "shipping.view", icon: Truck },
  { href: "/admin/catalog/products", label: "Catalog", permission: "catalog.view", icon: Boxes },
  { href: "/admin/inventory/overview", label: "Inventory", permission: "inventory.view", icon: ClipboardCheck },
  { href: "/admin/returns/requests", label: "Returns", permission: "returns.view", icon: Undo2 },
  { href: "/admin/payments", label: "Payments", permission: "payments.view", icon: CircleDollarSign },
  { href: "/admin/customers", label: "Customers", permission: "customers.view_masked", icon: Users },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.view", icon: Star },
  { href: "/admin/support/tickets", label: "Support", permission: "support.tickets.view", icon: Headphones },
  { href: "/admin/marketing/coupons", label: "Marketing", permission: "marketing.view", icon: Megaphone },
  { href: "/admin/notifications/templates", label: "Messages", permission: "notifications.view", icon: BellRing },
  { href: "/admin/cms/home", label: "CMS", permission: "cms.view", icon: FileText },
  { href: "/admin/analytics/overview", label: "Analytics", permission: "reports.operational.view", icon: BarChart3 },
  { href: "/admin/access/staff", label: "Access", permission: "staff.manage", icon: KeyRound },
  { href: "/admin/settings/store", label: "Settings", permission: "settings.manage", icon: Settings },
];

const notifications = [
  { title: "Webhook latency recovered", detail: "Razorpay delivery is back below 8 seconds.", time: "2m", icon: Activity, tone: "success" },
  { title: "Six variants below buffer", detail: "Drop 001 stock needs a replenishment decision.", time: "14m", icon: Boxes, tone: "warning" },
  { title: "Return SLA approaching", detail: "RMA-1042 has 38 minutes remaining for QC.", time: "31m", icon: AlertTriangle, tone: "warning" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staffSession, can, signOutStaff } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const initials = staffSession?.name.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "--";
  const visibleNavigation = navigation.filter((item) => can(item.permission));
  const matchingNavigation = visibleNavigation.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const currentArea = visibleNavigation.find((item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href.split("/").slice(0, 3).join("/"))))?.label ?? "Operations";

  useEffect(() => {
    const openCommand = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", openCommand);
    return () => window.removeEventListener("keydown", openCommand);
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-wordmark" href="/admin">ICED_OUT <span>OPS</span></Link>
        <p>{staffSession?.role ?? "Staff"} workspace</p>
        <nav aria-label="Administration">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link className={pathname === href || (href !== "/admin" && pathname.startsWith(href.split("/").slice(0, 3).join("/"))) ? "is-current" : ""} href={href} key={href}>
              <Icon aria-hidden="true" size={17} />
              {label}
              <span className="admin-nav-signal" />
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__scope"><span>Store</span><strong>India / Primary</strong><small><i className="status-dot" /> Preview connected</small></div>
          <Link className="admin-store-link" href="/"><Store aria-hidden="true" size={16} /> Storefront</Link>
          <button type="button" onClick={() => { signOutStaff(); router.push("/admin/login"); }}><LogOut aria-hidden="true" size={16} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-route-context"><span>Workspace</span><strong>{currentArea}</strong></div>
          <button className="admin-global-search" type="button" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Order, payment, product, SKU, AWB, ticket…</span><kbd><Command size={11} /> K</kbd></button>
          <div className="admin-topbar__tools">
            <span className="admin-environment"><i className="status-dot" /> Preview</span>
            <button className="admin-notifications" aria-label="Open operations notifications" type="button" onClick={() => setNotificationsOpen(true)}><Bell size={16} /><b>3</b></button>
            <div className="admin-identity"><span>{initials}</span><p>{staffSession?.name}<br /><small>{staffSession?.role} · scoped access</small></p></div>
          </div>
        </header>
        <main className="admin-route-stage">
          {children}
        </main>
      </div>

      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-dialog-overlay" />
          <Dialog.Content className="admin-command-dialog">
            <Dialog.Title>Jump to workspace</Dialog.Title>
            <Dialog.Description>Search operational modules and move without losing context.</Dialog.Description>
            <label className="admin-command-input"><Search size={18} /><span className="sr-only">Search workspaces</span><input autoFocus placeholder="Type a module name…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></label>
            <div className="admin-command-results">
              <span>Destinations / {matchingNavigation.length.toString().padStart(2, "0")}</span>
              {matchingNavigation.map(({ href, label, icon: Icon }, index) => <Link href={href} key={href} onClick={() => setCommandOpen(false)}><Icon size={17} /><span><strong>{label}</strong><small>{href}</small></span><b>{(index + 1).toString().padStart(2, "0")}</b><ArrowRight size={15} /></Link>)}
              {!matchingNavigation.length && <p>No workspace matches that signal.</p>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-dialog-overlay" />
          <Dialog.Content className="admin-notification-drawer">
            <header><div><Dialog.Title>Operations pulse</Dialog.Title><Dialog.Description>Three signals need awareness, not panic.</Dialog.Description></div><Dialog.Close aria-label="Close notifications"><X size={18} /></Dialog.Close></header>
            <div className="admin-notification-list">
              {notifications.map(({ title, detail, time, icon: Icon, tone }) => <article key={title} className={`is-${tone}`}><span><Icon size={17} /></span><div><strong>{title}</strong><p>{detail}</p><small>{time} ago</small></div></article>)}
            </div>
            <footer><span><i className="status-dot" /> Live preview data</span><Link href="/admin/notifications/delivery-logs" onClick={() => setNotificationsOpen(false)}>Open delivery logs <ArrowRight size={14} /></Link></footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
