export type RouteAudience = "staff";

export type RouteRule = {
  pattern: RegExp;
  audience: RouteAudience;
};

/**
 * Everything behind the sign-in wall — which, on this deployment, is everything
 * except the three auth screens.
 *
 * The storefront's copy of this file lists customer routes and no staff ones;
 * this one is the mirror image. Two sites, two audiences, one shape.
 *
 * The rules are declared as a LIST OF PREFIXES rather than one catch-all, even
 * though the catch-all below would cover them, because `getRouteRule` is also
 * what tells a screen which audience it belongs to — and an explicit table is
 * what makes adding a public route (a status page, a shared board) a one-line
 * change rather than a rewrite of the guard.
 */
export const protectedRouteRules: RouteRule[] = [
  { pattern: /^\/leads(?:\/|$)/, audience: "staff" },
  { pattern: /^\/contacts(?:\/|$)/, audience: "staff" },
  { pattern: /^\/companies(?:\/|$)/, audience: "staff" },
  { pattern: /^\/deals(?:\/|$)/, audience: "staff" },
  { pattern: /^\/tasks(?:\/|$)/, audience: "staff" },
  { pattern: /^\/payments(?:\/|$)/, audience: "staff" },
  { pattern: /^\/orders(?:\/|$)/, audience: "staff" },
  { pattern: /^\/shipments(?:\/|$)/, audience: "staff" },
  { pattern: /^\/catalog(?:\/|$)/, audience: "staff" },
  { pattern: /^\/inventory(?:\/|$)/, audience: "staff" },
  { pattern: /^\/returns(?:\/|$)/, audience: "staff" },
  { pattern: /^\/vouchers(?:\/|$)/, audience: "staff" },
  { pattern: /^\/customers(?:\/|$)/, audience: "staff" },
  { pattern: /^\/reviews(?:\/|$)/, audience: "staff" },
  { pattern: /^\/support(?:\/|$)/, audience: "staff" },
  { pattern: /^\/analytics(?:\/|$)/, audience: "staff" },
  { pattern: /^\/settings(?:\/|$)/, audience: "staff" },
  { pattern: /^\/home(?:\/|$)/, audience: "staff" },
  { pattern: /^\/profile(?:\/|$)/, audience: "staff" },
  /* The dashboard. Last, and anchored to the bare root: a `^\/` prefix rule
     placed any earlier would swallow /login as well and lock the door from the
     inside. */
  { pattern: /^\/$/, audience: "staff" },
];

/** The screens that must stay reachable while signed out. */
export const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"] as const;

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getRouteRule(pathname: string) {
  if (isPublicRoute(pathname)) return undefined;
  return protectedRouteRules.find((rule) => rule.pattern.test(pathname));
}

export function safeReturnPath(value: string | null, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
