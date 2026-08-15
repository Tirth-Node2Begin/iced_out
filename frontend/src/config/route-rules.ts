export type RouteAudience = "customer" | "staff";

export type RouteRule = {
  pattern: RegExp;
  audience: RouteAudience;
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
  { pattern: /^\/admin\/payments(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/orders(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/shipments(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/catalog(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/inventory(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/returns(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/vouchers(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/customers(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/reviews(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/support(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/analytics(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin\/settings(?:\/|$)/, audience: "staff" },
  { pattern: /^\/admin(?:\/|$)/, audience: "staff" },
];

export function getRouteRule(pathname: string) {
  return protectedRouteRules.find((rule) => rule.pattern.test(pathname));
}

export function safeReturnPath(value: string | null, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
