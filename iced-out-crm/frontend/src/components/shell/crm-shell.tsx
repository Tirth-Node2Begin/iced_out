"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ChevronsLeft,
  CircleDollarSign,
  ClipboardCheck,
  Command,
  Contact,
  Gauge,
  Headphones,
  Handshake,
  ListChecks,
  LogOut,
  Menu,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Truck,
  Undo2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { PulseBell } from "@/components/shell/pulse-bell";
import { useCrmCounts } from "@/features/22-crm/crm-api";
import { useQueues, type Queues } from "@/features/15-dashboard/dashboard-api";
import { useAuth } from "@/features/20-auth-security/auth-context";
import { isHiddenArea } from "@/config/hidden-areas";
import { crumbsFor } from "@/lib/breadcrumbs";

/**
 * The CRM's chrome.
 *
 * Floating chrome on a deeper canvas: the rail and the bar are CARDS lifted off
 * the page, inset by one shared gutter, and the canvas shows around both. The
 * geometry is the style guide's — 18px gutter, 68→272px rail, 54px bar, 26px
 * and 20px radii, one 260ms curve for the whole shell — and the palette is the
 * storefront's.
 *
 * Three facts about this shell that break code if you forget them:
 *
 *  1. `<main>` is the scroll container, NOT the document. Anything that locks
 *     scroll or positions a fixed overlay has to account for it.
 *  2. The frame's left margin tracks the PINNED width only. A hover-expand
 *     overlays the content deliberately — a cursor passing over the rail must
 *     never reflow the page.
 *  3. The rail lists areas, and ONE area also lists its screens: Inventory
 *     carries seven, which is more than a tab strip can hold without becoming
 *     a second row of chrome above every register in the area. Its screens are
 *     `children` on the lane and appear in the rail while you are in it.
 *
 *     Everywhere else the original rule still stands — Catalog, Payments,
 *     Shipments and Returns keep their tabs (`AdminModuleNav`), because two or
 *     three screens read fine as a strip and a rail that expanded under every
 *     lane would be the unlearnable two-level tree this note was written to
 *     prevent. The exception is the size of the area, not a change of mind.
 */

type Lane = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which of the dashboard's six commerce counts this lane answers to. */
  queue?: keyof Queues;
  /** Or one of the CRM's own counts. */
  crm?: "leads" | "tasks";
  /**
   * The area's own screens, listed under it while you are inside the area.
   *
   * Only Inventory has these — see note 3 at the top. They are declared here
   * rather than in the feature so the rail stays the single place every
   * destination in this console is written down.
   */
  children?: { href: string; label: string }[];
};

type Group = { title: string; lanes: Lane[] };

/**
 * Seven groups, nineteen lanes.
 *
 * The order is the working day, not the alphabet: what is waiting on you, then
 * the conversations, then the money those conversations became, then the things
 * being sold, then the people buying them, then what it all added up to.
 *
 * A lane's badge is WORK WAITING in that area, counted by the server. Lanes
 * without one carry no badge, because nothing queues in them — a catalogue is a
 * place you go to, not a queue that comes to you.
 */
const GROUPS: Group[] = [
  {
    title: "Overview",
    lanes: [{ href: "/", label: "Dashboard", icon: Gauge }],
  },
  {
    title: "Relationships",
    lanes: [
      { href: "/leads", label: "Leads", icon: Sparkles, crm: "leads" },
      { href: "/contacts", label: "Contacts", icon: Contact },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/tasks", label: "Tasks", icon: ListChecks, crm: "tasks" },
    ],
  },
  {
    title: "Selling",
    lanes: [
      { href: "/orders", label: "Orders", icon: ShoppingBag, queue: "ordersToConfirm" },
      { href: "/shipments/active", label: "Shipments", icon: Truck, queue: "readyToDispatch" },
      {
        href: "/returns/requests",
        label: "Returns & Exchanges",
        icon: Undo2,
        queue: "returnsToReview",
      },
      { href: "/payments", label: "Payments", icon: CircleDollarSign, queue: "paymentExceptions" },
      /* Its own lane, not a tab inside Returns. A return is where most vouchers
         come FROM, but the ledger is read for its own reasons — what the store
         owes, what has been spent — and looking that up should not mean first
         picking your way into a module about something else. */
      { href: "/vouchers", label: "Vouchers", icon: Ticket },
    ],
  },
  {
    title: "Catalogue",
    lanes: [
      { href: "/catalog/products", label: "Catalog", icon: Boxes },
      {
        href: "/inventory/overview",
        label: "Inventory",
        icon: ClipboardCheck,
        queue: "stockAtRisk",
        /* The order is the FLOW, not the alphabet — material comes in on the
           left and leaves as a finished garment on the right. Warehouses sits
           last because it is the place all of that happens in rather than a
           step in it. */
        children: [
          { href: "/inventory/suppliers", label: "Suppliers" },
          { href: "/inventory/purchases", label: "Purchases" },
          { href: "/inventory/materials", label: "Materials" },
          { href: "/inventory/production", label: "Production" },
          { href: "/inventory/overview", label: "Stock" },
          { href: "/inventory/transfers", label: "Transfers" },
          { href: "/inventory/warehouses", label: "Warehouses" },
        ],
      },
      /* The storefront's own pages, not the things sold on them. It sits beside
         Catalog because that is the order the work happens in — a garment is
         stocked, listed, and then chosen to lead the home page. */
      { href: "/home/hero", label: "Home page", icon: Shirt },
    ],
  },
  {
    title: "Audience",
    lanes: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/support", label: "Support", icon: Headphones, queue: "openTickets" },
    ],
  },
  { title: "Insight", lanes: [{ href: "/analytics", label: "Analytics", icon: BarChart3 }] },
  { title: "System", lanes: [{ href: "/settings/store", label: "Settings", icon: Settings }] },
];

/* What is actually offered. An area named in `HIDDEN_AREAS` loses its lane
   here, which takes it out of the rail AND out of the "Go to…" palette in one
   move, because both read this. A group left with no lanes at all drops out
   rather than printing a heading over nothing. */
const VISIBLE_GROUPS: Group[] = GROUPS.map((group) => ({
  ...group,
  lanes: group.lanes.filter((lane) => !isHiddenArea(lane.href)),
})).filter((group) => group.lanes.length > 0);

const ALL_LANES = VISIBLE_GROUPS.flatMap((group) => group.lanes);

/** The area a path belongs to — the rail highlights areas, not screens. */
function areaOf(href: string) {
  return href === "/" ? "/" : `/${href.split("/").filter(Boolean)[0]}`;
}

function isCurrent(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  const area = areaOf(href);
  return pathname === area || pathname.startsWith(`${area}/`);
}

const PIN_KEY = "iced_crm_rail_pinned";

/**
 * One shared component for every collapsible text run — nav label, group
 * heading, brand block — so the whole card reads as ONE motion rather than four
 * things that happen to ease at the same time.
 */
function Reveal({ children }: { children: ReactNode }) {
  return <span className="aui-reveal">{children}</span>;
}

export function CrmShell({ children }: { children: ReactNode }) {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Keep the screen you are on in view.
   *
   * The rail already overflowed at nineteen lanes; Inventory's seven screens
   * push it a further ~210px, and measured at 950px and 800px tall that put the
   * LAST of them — Warehouses — below the fold. Navigating to a screen and
   * having the rail show no sign of where you are is worse than the tab strip
   * this replaced, so the active row is scrolled to whenever the route changes.
   *
   * `block: "nearest"` does nothing when the row is already visible, which is
   * the common case, and moves the minimum when it is not. A DOM side effect,
   * not a setState — which is the distinction this repo's lint rule draws.
   */
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('.aui-rail__sub a[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  const { staffSession, signOutStaff } = useAuth();
  /* The six commerce queue counts. The dashboard reads the same store, so
     opening the console makes one request for both. */
  const { queues } = useQueues();
  /* And the two CRM ones — open leads, and tasks overdue for whoever is
     signed in. */
  const counts = useCrmCounts();

  /* Read lazily in the initializer rather than in an effect: setState-in-effect
     would paint the collapsed rail and then snap it open on the next frame, and
     this component is client-only so there is no hydration pass to mismatch. */
  const [pinned, setPinned] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      /* No stored value means nobody has chosen yet, and the answer to that is
         OPEN. Collapsed, the rail is nineteen bare glyphs: someone opening this
         console for the first time has to recognise every icon before they can
         go anywhere, and the labels ARE the map of the business. Only an
         explicit "0" — written by the pin control — collapses it, so an
         operator who prefers the narrow rail still gets it on every visit. */
      return window.localStorage.getItem(PIN_KEY) !== "0";
    } catch {
      /* A private window, or site data blocked. Open is the right answer to
         "we could not find out", and it is never worth an error. */
      return true;
    }
  });
  const [hovered, setHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const account = useRef<HTMLDivElement>(null);

  const expanded = pinned || hovered || drawerOpen;

  const togglePin = useCallback(() => {
    setPinned((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        /* Same as the read: the preference simply does not persist. */
      }
      return next;
    });
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === "" ? ALL_LANES : ALL_LANES.filter((l) => l.label.toLowerCase().includes(needle));
  }, [query]);

  const crumbs = useMemo(() => crumbsFor(pathname), [pathname]);

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
         escape — the palette below gets its from Radix. */
      if (event.key === "Escape") {
        setAccountOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Touch has no mouse-leave to dismiss the account menu with, so a press
     anywhere outside it does the job. Bound only while it is open — a document
     listener for a menu nobody opened runs on every press in the console. */
  useEffect(() => {
    if (!accountOpen) return;

    const onPress = (event: PointerEvent) => {
      if (!account.current?.contains(event.target as Node)) setAccountOpen(false);
    };

    document.addEventListener("pointerdown", onPress);
    return () => document.removeEventListener("pointerdown", onPress);
  }, [accountOpen]);

  /**
   * The active row's cursor-tracked light. Written straight to CSS custom
   * properties on the row — never to React state, because a setState per
   * mousemove would re-render the whole nav ~60 times a second.
   */
  const trackSpot = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const row = event.currentTarget;
    const box = row.getBoundingClientRect();
    row.style.setProperty("--aui-spot-x", `${event.clientX - box.left}px`);
    row.style.setProperty("--aui-spot-y", `${event.clientY - box.top}px`);
  }, []);

  const badgeFor = (lane: Lane) => {
    if (lane.queue) return { count: queues[lane.queue].count, tone: "queue" as const };
    if (lane.crm === "leads") return { count: counts.openLeads, tone: "queue" as const };
    if (lane.crm === "tasks") return { count: counts.myOverdue, tone: "overdue" as const };
    return { count: 0, tone: "queue" as const };
  };

  return (
    <div
      className="aui-app"
      /* Two widths, and they are deliberately not the same one.
         `--aui-rail-w` is how wide the CARD is drawn — it follows `expanded`,
         so a hover opens it. `--aui-sb` is the column the frame RESERVES, and
         it follows `pinned` alone: a hover-expand overlays the content on
         purpose, because a cursor passing over the rail must never reflow the
         page under it. */
      style={{
        ["--aui-rail-w" as string]: expanded
          ? "var(--aui-rail-expanded)"
          : "var(--aui-rail-collapsed)",
        ["--aui-sb" as string]: pinned
          ? "var(--aui-rail-expanded)"
          : "var(--aui-rail-collapsed)",
      }}
    >
      <aside
        className="aui-rail"
        data-drawer={drawerOpen ? "true" : "false"}
        data-expanded={expanded ? "true" : "false"}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link className="aui-rail__brand" href="/">
          <span className="aui-rail__mark">
            <i>
              <Command aria-hidden size={16} strokeWidth={2.2} />
            </i>
          </span>
          <Reveal>
            <b>ICED_OUT</b>
            <small>CRM</small>
          </Reveal>
        </Link>

        <div className="aui-rail__search">
          <button onClick={() => setPaletteOpen(true)} type="button">
            <i>
              <Search aria-hidden size={16} strokeWidth={1.8} />
            </i>
            <Reveal>
              {/* "Go to", not "Search". This palette matches SCREEN names and
                  nothing else — somebody who reads "Search" here types a
                  customer's name, gets no results, and concludes the console
                  cannot find their customer. Each register has its own search
                  box over its own rows; this is the way between them. */}
              <span>Go to…</span>
            </Reveal>
            {expanded && (
              <kbd>
                <Command aria-hidden size={9} strokeWidth={2.4} />K
              </kbd>
            )}
          </button>
        </div>

        {/* The drawer must not survive a navigation: below the shell breakpoint
            it covers the screen, and arriving underneath it means dismissing a
            sheet to see the thing you asked for.
 
            Handled on the CLICK rather than on `pathname` changing, and not only
            because a setState in an effect body is an error in this repo — the
            click IS the intent. It sits on the nav and the foot rather than on
            the whole card, so pinning and scrolling the lanes, which are the two
            interactions in here that are not a departure, leave it open. */}
        <nav
          aria-label="Workspace"
          className="aui-rail__nav"
          onClick={() => setDrawerOpen(false)}
          ref={navRef}
        >
          {VISIBLE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="aui-rail__group">
                <Reveal>{group.title}</Reveal>
              </p>

              {group.lanes.map((lane) => {
                const current = isCurrent(lane.href, pathname);
                const badge = badgeFor(lane);
                const Icon = lane.icon;

                /* The area's screens, and only while you are standing in it.

                   Two conditions, both load-bearing. `current`, because a rail
                   that listed every area's screens at once would be a
                   permanently open tree nineteen lanes deep — expanding on
                   arrival is what keeps it a rail. And `expanded`, because at
                   68px the rail is icons and a sub-lane has no icon to be; there
                   is nothing to draw, so nothing is drawn, and the list comes
                   back when the rail does. */
                const screens = lane.children && expanded && current ? lane.children : null;

                return (
                  /* Fragment, so the screens sit directly under their own lane
                     rather than after everything else in the group. */
                  <Fragment key={lane.href}>
                  <Link
                    aria-current={current ? "page" : undefined}
                    href={lane.href}
                    onMouseMove={current ? trackSpot : undefined}
                    title={expanded ? undefined : lane.label}
                  >
                    <Icon aria-hidden size={18} strokeWidth={current ? 1.9 : 1.6} />
                    <Reveal>{lane.label}</Reveal>
                    {/* Absent when the queue is empty, never a "00": a badge on
                        every lane saying nothing is needed is furniture, and it
                        teaches an operator to stop reading the ones that mean
                        something. */}
                    {badge.count > 0 && (
                      <span
                        /* The number alone reads as a quantity of nothing in
                           particular to a screen reader, which announces the
                           lane and then "12". */
                        aria-label={`${badge.count} waiting`}
                        className="aui-rail__count"
                        data-tone={badge.tone}
                      >
                        {badge.count > 99 ? "99+" : String(badge.count).padStart(2, "0")}
                      </span>
                    )}
                  </Link>

                  {screens && (
                    <div className="aui-rail__sub">
                      {screens.map((screen) => (
                        <Link
                          aria-current={pathname === screen.href ? "page" : undefined}
                          href={screen.href}
                          key={screen.label}
                        >
                          <Reveal>{screen.label}</Reveal>
                        </Link>
                      ))}
                    </div>
                  )}
                  </Fragment>
                );
              })}

            </div>
          ))}
        </nav>

        <div className="aui-rail__foot" onClick={() => setDrawerOpen(false)}>
          <button onClick={() => { signOutStaff(); router.push("/login"); }} type="button">
            <LogOut aria-hidden size={16} strokeWidth={1.7} />
            <Reveal>Sign out</Reveal>
          </button>
        </div>

        <button
          aria-label={pinned ? "Unpin the navigation" : "Pin the navigation open"}
          className="aui-rail__pin"
          data-pinned={pinned ? "true" : "false"}
          onClick={togglePin}
          type="button"
        >
          <ChevronsLeft aria-hidden size={13} strokeWidth={2.2} />
        </button>
      </aside>

      {/* Always mounted so it can fade BOTH ways — mounting it conditionally
          gives a fade-in and then a hard cut. */}
      <button
        aria-hidden={!drawerOpen}
        aria-label="Close navigation"
        className="aui-scrim"
        data-open={drawerOpen ? "true" : "false"}
        onClick={() => setDrawerOpen(false)}
        tabIndex={drawerOpen ? 0 : -1}
        type="button"
      />

      <div className="aui-frame">
        <header className="aui-topbar">
          <div className="aui-topbar__inner">
            {/* Inside the bar on purpose: as a fixed button at the same 18px
                inset it landed straight on top of the breadcrumb. */}
            <button
              aria-label="Open navigation"
              className="aui-railbtn"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <Menu aria-hidden size={18} strokeWidth={1.8} />
            </button>

            <nav aria-label="Breadcrumb" className="aui-crumbs">
              {crumbs.parents.map((parent) => (
                <span className="aui-crumbs__parent" key={parent.href ?? parent.label}>
                  {parent.href ? <Link href={parent.href}>{parent.label}</Link> : <span>{parent.label}</span>}
                  <i> / </i>
                </span>
              ))}
              <strong>{crumbs.current}</strong>
            </nav>

            <div className="aui-topbar__tools">
              <PulseBell />

              <span className="aui-topbar__divider" />

              {/* Hover opens it, but hover cannot be the only way in: the same
                  state is set on focus, so it reaches the keyboard, and on
                  click, so it reaches touch — where there is no hover to give.
                  Blur closes it only when focus has actually left the group,
                  otherwise tabbing from the chip into its own first item would
                  shut the thing being tabbed into.

                  Click OPENS rather than toggles. A toggle reads correctly until
                  you remember that pointing at the chip has already opened it —
                  every mouse click would then arrive on an open menu and close
                  it, and a tap does the same, because touch fires hover first. */}
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
                  <Link href="/profile" onClick={() => setAccountOpen(false)} role="menuitem">
                    <UserRound aria-hidden size={15} strokeWidth={1.7} /> Your profile
                  </Link>
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      signOutStaff();
                      router.push("/login");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut aria-hidden size={15} strokeWidth={1.7} /> Sign out
                  </button>
                </div>
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
            <Dialog.Title className="sr-only">Go to a screen</Dialog.Title>
            <Dialog.Description className="sr-only">
              Type the name of a screen you have access to and go straight to it.
            </Dialog.Description>

            <label className="aui-palette__field">
              <Search aria-hidden size={17} strokeWidth={1.7} />
              <span className="sr-only">Go to a screen</span>
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Go to a screen — orders, products, customers…"
                value={query}
              />
              <kbd>ESC</kbd>
            </label>

            <div className="aui-palette__list">
              <span>
                {matches.length} {matches.length === 1 ? "screen" : "screens"}
              </span>
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
                <p className="aui-palette__empty">
                  No screen is called “{query}”. To find an order or a customer, open that
                  screen and use the search box on it.
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
