export type RouteAudience = "customer" | "staff";

export type RouteRule = {
  pattern: RegExp;
  audience: RouteAudience;
  permission?: string;
};

export const protectedRouteRules: RouteRule[] = [
  /* /cart is deliberately NOT here. Filling a bag and reading it back is
     browsing, not account work: gating it sent a shopper to the login page for
     pressing "add to bag", and there is nothing behind that wall worth
     protecting — the bag holds public catalogue prices and lives in the
     visitor's own browser. The customer boundary starts at checkout, which is
     the first screen with an address, a payment and an order on it. */
  { pattern: /^\/checkout(?:\/|$)/, audience: "customer" },
  /* The screen a purchase lands on. It carries the delivery address, the
     contact and the payment reference, so it belongs behind the same wall as
     the archive — the parcel's own progress is public through /track/<token>,
     which is a shareable link precisely because it names none of that. */
  { pattern: /^\/orders(?:\/|$)/, audience: "customer" },
  { pattern: /^\/account(?:\/|$)/, audience: "customer" },
  { pattern: /^\/admin\/payments(?:\/|$)/, audience: "staff", permission: "payments.view" },
  { pattern: /^\/admin\/orders(?:\/|$)/, audience: "staff", permission: "orders.view" },
  { pattern: /^\/admin\/shipments(?:\/|$)/, audience: "staff", permission: "shipping.view" },
  { pattern: /^\/admin\/catalog(?:\/|$)/, audience: "staff", permission: "catalog.view" },
  { pattern: /^\/admin\/inventory(?:\/|$)/, audience: "staff", permission: "inventory.view" },
  { pattern: /^\/admin\/fulfilment(?:\/|$)/, audience: "staff", permission: "fulfilment.view" },
  { pattern: /^\/admin\/returns(?:\/|$)/, audience: "staff", permission: "returns.view" },
  { pattern: /^\/admin\/customers(?:\/|$)/, audience: "staff", permission: "customers.view_masked" },
  { pattern: /^\/admin\/reviews(?:\/|$)/, audience: "staff", permission: "reviews.view" },
  { pattern: /^\/admin\/support(?:\/|$)/, audience: "staff", permission: "support.tickets.view" },
  { pattern: /^\/admin\/marketing(?:\/|$)/, audience: "staff", permission: "marketing.view" },
  { pattern: /^\/admin\/notifications(?:\/|$)/, audience: "staff", permission: "notifications.view" },
  { pattern: /^\/admin\/cms(?:\/|$)/, audience: "staff", permission: "cms.view" },
  { pattern: /^\/admin\/analytics(?:\/|$)/, audience: "staff", permission: "reports.operational.view" },
  { pattern: /^\/admin\/access\/(?:roles|permissions)(?:\/|$)/, audience: "staff", permission: "roles.manage" },
  { pattern: /^\/admin\/access\/audit-log(?:\/|$)/, audience: "staff", permission: "audit.view" },
  { pattern: /^\/admin\/access(?:\/|$)/, audience: "staff", permission: "staff.manage" },
  { pattern: /^\/admin\/settings(?:\/|$)/, audience: "staff", permission: "settings.manage" },
  { pattern: /^\/admin(?:\/|$)/, audience: "staff", permission: "dashboard.view" },
];

export function getRouteRule(pathname: string) {
  return protectedRouteRules.find((rule) => rule.pattern.test(pathname));
}

export function safeReturnPath(value: string | null, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
