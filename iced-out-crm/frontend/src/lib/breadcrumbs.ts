/**
 * The bar's breadcrumb, derived purely from the URL.
 *
 * Purely, so a route added later works with no registration step — the only
 * cost is the two lookup tables below, which exist to fix what a prettifier
 * cannot infer.
 *
 * It is a TRAIL, not a page title: every screen renders its own head card with
 * its own heading, and repeating that in the bar wastes the one horizontal run
 * the console has. What the bar adds is where you are relative to everything
 * else.
 */

type Crumb = { label: string; href?: string };

export type Trail = {
  /** Ancestors, outermost first. Folded away below `sm`. */
  parents: Crumb[];
  /** The screen you are on. Always survives. */
  current: string;
};

/**
 * Full path → the page's real name, used for the LAST crumb.
 *
 * `/leads` is "Leads" either way; the entries that earn their place are the ones
 * where the folder name and the page name differ — `/home/hero` is the Hero
 * board, and its parent reads "Home page".
 */
const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/contacts/detail": "Contact",
  "/companies": "Companies",
  "/companies/detail": "Company",
  "/deals": "Pipeline",
  "/tasks": "Tasks",
  "/orders": "Order register",
  "/orders/detail": "Order",
  "/customers": "Customer register",
  "/customers/detail": "Customer",
  "/catalog/products": "Products",
  "/catalog/products/edit": "Edit product",
  "/catalog/categories": "Categories",
  "/catalog/collections": "Collections",
  "/inventory/overview": "Stock overview",
  "/inventory/warehouses": "Warehouses",
  "/inventory/transfers": "Transfers",
  "/shipments/active": "Active parcels",
  "/shipments/failed": "Failed deliveries",
  "/shipments/pickups": "Courier pickups",
  "/shipments/detail": "Shipment",
  "/returns/requests": "Return requests",
  "/returns/exchanges": "Exchanges",
  "/returns/detail": "Return",
  "/payments": "Payments ledger",
  "/payments/payouts": "Payouts",
  "/payments/detail": "Payment",
  "/vouchers": "Vouchers",
  "/reviews": "Reviews",
  "/support": "Support desk",
  "/analytics": "Analytics",
  "/settings/store": "Store settings",
  "/home/hero": "Hero board",
  "/profile": "Your profile",
};

/** Per-segment fixes the prettifier cannot infer. */
const SEGMENT_LABELS: Record<string, string> = {
  crm: "CRM",
  catalog: "Catalogue",
  home: "Home page",
  detail: "Detail",
  ndr: "NDR",
};

/**
 * Paths that are real pages and may therefore be linked as a parent. A segment
 * that is only a folder — `/settings`, `/shipments` on their own — stays plain
 * text rather than becoming a dead link.
 */
const LINKABLE_PARENTS = new Set([
  "/leads",
  "/contacts",
  "/companies",
  "/deals",
  "/tasks",
  "/orders",
  "/customers",
  "/payments",
  "/vouchers",
  "/reviews",
  "/support",
  "/analytics",
]);

/**
 * Record ids never reach the trail.
 *
 * Bare numbers, uuids, and opaque tokens — anything eight characters or longer
 * that carries a digit and no separator. `afterdark-hoodie` survives because of
 * the hyphen; `IO-2026-1049` survives for the same reason and is filtered by the
 * query-string rule instead, since this app carries record ids in `?id=`.
 */
function isIdSegment(segment: string) {
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return true;
  return segment.length >= 8 && /\d/.test(segment) && !/[-_]/.test(segment);
}

function prettify(segment: string) {
  const fixed = SEGMENT_LABELS[segment];
  if (fixed) return fixed;

  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function crumbsFor(pathname: string): Trail {
  /* Query and hash are dropped wholesale: this app carries record ids there,
     and "Order · ?id=ord-local-07" is not a place. */
  const clean = pathname.split("?")[0].split("#")[0];

  if (clean === "/" || clean === "") return { parents: [], current: PAGE_LABELS["/"] };

  const segments = clean.split("/").filter(Boolean).filter((s) => !isIdSegment(s));

  if (segments.length === 0) return { parents: [], current: PAGE_LABELS["/"] };

  const parents: Crumb[] = [{ label: PAGE_LABELS["/"], href: "/" }];

  for (let i = 0; i < segments.length - 1; i += 1) {
    const href = "/" + segments.slice(0, i + 1).join("/");
    parents.push({
      label: PAGE_LABELS[href] ?? prettify(segments[i]),
      href: LINKABLE_PARENTS.has(href) || href in PAGE_LABELS ? href : undefined,
    });
  }

  const current = PAGE_LABELS[clean] ?? prettify(segments[segments.length - 1]);

  return { parents, current };
}
