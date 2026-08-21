"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Command,
  Gauge,
  Headphones,
  LogOut,
  Menu,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Star,
  Store,
  Ticket,
  Truck,
  Undo2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { PulseBell } from "@/components/admin/pulse-bell";
import { useQueues, type Queues } from "@/features/15-dashboard/dashboard-api";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The console's chrome.
 *
 * A floating rail and a floating topbar with the page showing around both, so
 * the whole console reads as cards on one surface — the same construction the
 * account screens use, at operator scale.
 *
 * The rail lists fourteen areas and nothing else: no nested tree, no
 * accordions. Where an area has more than one screen, those screens are tabs
 * across the top of the area (`AdminModuleNav`), not a second level in the
 * rail. Two levels of navigation in one column is how an operations console
 * becomes unlearnable.
 *
 * A lane's badge is WORK WAITING in that area, counted by the server.
 *
 * Three of them used to be written here as strings — Orders "12", Returns "05",
 * Support "02" — so the rail announced twelve orders to a shop that had one, and
 * five returns to a shop that had none. A badge that cannot change is worse than
 * no badge: it teaches an operator to stop reading it.
 *
 * `queue` names which of the dashboard's six counts a lane answers to. Lanes
 * without one carry no badge, because there is nothing waiting in them — a
 * catalogue is a place you go to, not a queue that comes to you.
 */
const NAVIGATION = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, queue: "ordersToConfirm" },
  { href: "/admin/shipments/active", label: "Shipments", icon: Truck, queue: "readyToDispatch" },
  { href: "/admin/catalog/products", label: "Catalog", icon: Boxes },
  /* The storefront's own pages, not the things sold on them. It sits beside
     Catalog because that is the order the work happens in — a garment is
     stocked, listed, and then chosen to lead the home page. */
  { href: "/admin/home/hero", label: "Home page", icon: Shirt },
  {
    href: "/admin/inventory/overview",
    label: "Inventory",
    icon: ClipboardCheck,
    queue: "stockAtRisk",
  },
  {
    href: "/admin/returns/requests",
    label: "Returns & Exchanges",
    icon: Undo2,
    queue: "returnsToReview",
  },
  /* Its own area, not a tab inside Returns. A return is where most vouchers
     come FROM, but the ledger is read for its own reasons — what the store
     owes, what has been spent — and looking that up should not mean first
     picking your way into a module about something else. */
  { href: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CircleDollarSign,
    queue: "paymentExceptions",
  },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/support", label: "Support", icon: Headphones, queue: "openTickets" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings/store", label: "Settings", icon: Settings },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  queue?: keyof Queues;
}>;

/**
 * Screens the rail deliberately does not list.
 *
 * The account menu is the only way to the profile, which means the rail has no
 * lane to match it against and the topbar would fall back to naming the whole
 * console. It still has to be able to say where you are.
 */
const OFF_RAIL: Record<string, string> = {
  "/admin/profile": "Profile",
};

/** The area a path belongs to — the rail highlights areas, not screens. */
function areaOf(href: string) {
  return href === "/admin" ? "/admin" : href.split("/").slice(0, 3).join("/");
}

function isCurrent(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  const area = areaOf(href);
  return pathname === area || pathname.startsWith(`${area}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staffSession, signOutStaff } = useAuth();
  /* The six queue counts, from `/admin/dashboard/queues`. The dashboard reads the
     same store, so opening the console makes one request for both. */
  const { queues } = useQueues();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const lanes = useRef<HTMLElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const [spill, setSpill] = useState({ above: false, below: false });

  /* Every area, every time. There is one role, so there is nothing to
     filter the rail against — a menu that never changes is also a menu an
     operator can learn the shape of. */
  const visible = NAVIGATION;
  const matches = visible.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const area =
    visible.find((item) => isCurrent(item.href, pathname))?.label ??
    OFF_RAIL[pathname] ??
    "Operations";
  const initials =
    staffSession?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "--";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      /* The account menu is not a dialog and traps nothing, so it needs its own
         escape — the dialogs below get theirs from Radix. */
      if (event.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Touch has no mouse-leave to dismiss the account menu with, so a press
     anywhere outside it does the job. Only bound while it is open — a listener
     on the document for a menu nobody has opened is a listener that runs on
     every press in the console. */
  useEffect(() => {
    if (!accountOpen) return;

    const onPress = (event: PointerEvent) => {
      if (!account.current?.contains(event.target as Node)) setAccountOpen(false);
    };

    document.addEventListener("pointerdown", onPress);
    return () => document.removeEventListener("pointerdown", onPress);
  }, [accountOpen]);

  /* Whether the lane list runs past either edge of its box — what decides if
     an arrow is showing. Watched on the element rather than computed from the
     item count, because the same fourteen lanes overflow or don't depending
     on the window height. The 2px slack keeps a chevron from flickering on a
     sub-pixel scroll offset. */
  useEffect(() => {
    const node = lanes.current;
    if (!node) return;

    const read = () => {
      const above = node.scrollTop > 2;
      const below = node.scrollTop + node.clientHeight < node.scrollHeight - 2;
      setSpill((current) =>
        current.above === above && current.below === below ? current : { above, below },
      );
    };

    read();
    node.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [visible.length]);

  /* The arrows travel the whole way rather than a screenful: the list is short
     enough that "the rest of it" is the useful destination, and the smoothing
     is CSS `scroll-behavior`, so a reduced-motion operator simply arrives. */
  const jumpLanes = useCallback((edge: "top" | "bottom") => {
    const node = lanes.current;
    if (node) node.scrollTo({ top: edge === "top" ? 0 : node.scrollHeight });
  }, []);

  return (
    <div className="aui-app">
      {/* Below 1020px the rail is an overlay, so anything clicked inside it
          closes it — otherwise the destination arrives underneath a sheet the
          operator then has to dismiss. Handled on the container rather than in
          an effect on `pathname`: the click is the intent, and a route that
          changes for another reason should not dismiss the menu. */}
      <aside
        className="aui-rail"
        data-open={railOpen ? "true" : "false"}
        onClick={() => setRailOpen(false)}
      >
        <Link className="aui-rail__brand" href="/admin">
          <span className="aui-rail__mark">
            <Command aria-hidden size={17} strokeWidth={2} />
          </span>
          <span>
            <b>ICED_OUT</b>
            <small>Operations</small>
          </span>
        </Link>

        {/* The arrows sit outside the scrolling nav so they stay pinned to its
            edges, and stop their click short of the rail — below 1020px the
            rail closes on any click inside it, and scrolling the lanes is the
            one interaction there that is not a departure. */}
        <div
          className="aui-rail__lanes"
          data-above={spill.above ? "true" : "false"}
          data-below={spill.below ? "true" : "false"}
        >
          <nav aria-label="Administration" className="aui-rail__nav" ref={lanes}>
            {visible.map(({ href, label, icon: Icon, ...rest }) => {
              /* Absent when the queue is empty, not a "00": a badge is a call for
                 attention, and one on every lane saying nothing is needed is just
                 thirteen pieces of furniture. */
              const waiting = "queue" in rest ? queues[rest.queue].count : 0;

              return (
                <Link
                  aria-current={isCurrent(href, pathname) ? "page" : undefined}
                  href={href}
                  key={href}
                >
                  <Icon aria-hidden size={16} strokeWidth={1.7} />
                  {label}
                  {waiting > 0 && (
                    <span
                      /* The number alone reads as a quantity of nothing in
                         particular to a screen reader, which announces the lane
                         and then "12". */
                      aria-label={`${waiting} waiting`}
                      className="aui-rail__count"
                    >
                      {waiting > 99 ? "99+" : String(waiting).padStart(2, "0")}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            aria-label="Scroll to the first area"
            className="aui-rail__more aui-rail__more--up"
            disabled={!spill.above}
            onClick={(event) => {
              event.stopPropagation();
              jumpLanes("top");
            }}
            type="button"
          >
            <i>
              <ChevronUp aria-hidden size={15} strokeWidth={2} />
            </i>
          </button>

          <button
            aria-label="Scroll to the last area"
            className="aui-rail__more aui-rail__more--down"
            disabled={!spill.below}
            onClick={(event) => {
              event.stopPropagation();
              jumpLanes("bottom");
            }}
            type="button"
          >
            <i>
              <ChevronDown aria-hidden size={15} strokeWidth={2} />
            </i>
          </button>
        </div>

        <div className="aui-rail__links">
          <Link href="/">
            <Store aria-hidden size={15} strokeWidth={1.7} /> View storefront
          </Link>
          <button
            onClick={() => {
              signOutStaff();
              router.push("/admin/login");
            }}
            type="button"
          >
            <LogOut aria-hidden size={15} strokeWidth={1.7} /> Sign out
          </button>
        </div>
      </aside>

      {railOpen && (
        <button
          aria-label="Close navigation"
          className="aui-scrim"
          onClick={() => setRailOpen(false)}
          type="button"
        />
      )}

      <div className="aui-main">
        <header className="aui-topbar">
          <button
            aria-label="Open navigation"
            className="aui-railbtn"
            onClick={() => setRailOpen(true)}
            type="button"
          >
            <Menu aria-hidden size={17} strokeWidth={1.8} />
          </button>

          <div className="aui-topbar__where">
            <span>Workspace</span>
            <strong>{area}</strong>
          </div>

          <button className="aui-search-trigger" onClick={() => setPaletteOpen(true)} type="button">
            <Search aria-hidden size={15} strokeWidth={1.7} />
            <span>Search orders, products, customers, tickets…</span>
            <kbd>
              <Command aria-hidden size={10} strokeWidth={2} />K
            </kbd>
          </button>

          <div className="aui-topbar__tools">
            <PulseBell />

            {/* Hover opens it, but hover cannot be the only way in: the same
                state is set on focus, so it reaches the keyboard, and on click,
                so it reaches touch — where there is no hover to give. Blur
                closes it only when focus has actually left the group,
                otherwise tabbing from the chip onto its own first item would
                shut the thing being tabbed into.

                Click OPENS rather than toggles. A toggle reads correctly until
                you remember that pointing at the chip has already opened it —
                every mouse click would then arrive on an open menu and close
                it, and a tap does the same, because touch fires the hover
                first. Dismissal is mouse-leave, Escape, blur, or the outside
                press handled in the effect above. */}
            <div
              className="aui-account"
              data-open={accountOpen ? "true" : "false"}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
              }}
              onFocus={() => setAccountOpen(true)}
              onMouseEnter={() => setAccountOpen(true)}
              onMouseLeave={() => setAccountOpen(false)}
              ref={account}
            >
              <button
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="aui-me"
                onClick={() => setAccountOpen(true)}
                type="button"
              >
                <span>{initials}</span>
                <p>
                  <strong>{staffSession?.name ?? "Staff"}</strong>
                  <small>{staffSession?.role ?? "Scoped access"}</small>
                </p>
                <ChevronDown aria-hidden className="aui-me__caret" size={14} strokeWidth={1.8} />
              </button>

              <div className="aui-account__menu" role="menu">
                <Link href="/admin/profile" onClick={() => setAccountOpen(false)} role="menuitem">
                  <UserRound aria-hidden size={15} strokeWidth={1.7} /> Your profile
                </Link>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    signOutStaff();
                    router.push("/admin/login");
                  }}
                  role="menuitem"
                  type="button"
                >
                  <LogOut aria-hidden size={15} strokeWidth={1.7} /> Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="aui-stage">{children}</main>
      </div>

      <Dialog.Root onOpenChange={setPaletteOpen} open={paletteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="aui-overlay" />
          <Dialog.Content className="aui-palette">
            <Dialog.Title className="sr-only">Jump to a workspace</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search the operations areas you have access to and move without losing context.
            </Dialog.Description>

            <label className="aui-palette__field">
              <Search aria-hidden size={17} strokeWidth={1.7} />
              <span className="sr-only">Search workspaces</span>
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type an area name…"
                value={query}
              />
              <kbd>ESC</kbd>
            </label>

            <div className="aui-palette__list">
              <span>{matches.length} destinations</span>
              {matches.map(({ href, label, icon: Icon }) => (
                <Link href={href} key={href} onClick={() => setPaletteOpen(false)}>
                  <Icon aria-hidden size={17} strokeWidth={1.7} />
                  <span>
                    <strong>{label}</strong>
                    <small>{href}</small>
                  </span>
                  <ArrowRight aria-hidden size={15} strokeWidth={1.7} />
                </Link>
              ))}
              {!matches.length && (
                <p className="aui-palette__empty">No area matches “{query}”.</p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
