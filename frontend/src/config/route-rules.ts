export type RouteAudience = "customer";

export type RouteRule = {
  pattern: RegExp;
  audience: RouteAudience;
};

/**
 * The customer wall. There is no staff audience here any more — the operations
 * console moved to the CRM, which is its own site with its own origin, its own
 * session cookie and its own copy of this file. A `/admin/*` path on the
 * storefront is a 404 now, not a gated route, which is the correct answer: this
 * deployment has no such screens to gate.
 */
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
];

export function getRouteRule(pathname: string) {
  return protectedRouteRules.find((rule) => rule.pattern.test(pathname));
}

export function safeReturnPath(value: string | null, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
