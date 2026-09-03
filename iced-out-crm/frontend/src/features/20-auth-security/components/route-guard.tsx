"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isHiddenArea } from "@/config/hidden-areas";
import { getRouteRule, isPublicRoute, safeReturnPath } from "@/config/route-rules";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The wall.
 *
 * Everything except the three auth screens is behind it, so this is closer to
 * "is anyone signed in" than to a per-route policy — but it still asks
 * `getRouteRule`, because that table is what makes adding a public screen later
 * a one-line change rather than an edit to this component.
 *
 * TWO THINGS THIS MUST NOT DO, both learned on the storefront:
 *
 *  1. It must not act before `staffReady`. The export is built with nobody
 *     signed in, so a guard that redirects on the first render bounces a
 *     signed-in operator to /login on every single reload.
 *  2. It must not render the children of a route it is about to leave. Showing
 *     the orders register for one frame before redirecting leaks the shape of
 *     the data to someone who is not signed in, and it flashes.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staffSession, staffReady } = useAuth();

  const rule = getRouteRule(pathname);
  const needsSession = rule !== undefined;
  const signedIn = staffSession !== null;
  /* A switched-off area. The screen still exists and still works — it is just
     not on offer, so a typed URL or an old bookmark goes to the dashboard
     instead of reaching a page the rail no longer admits to having. */
  const hidden = isHiddenArea(pathname);

  useEffect(() => {
    if (!staffReady) return;

    if (hidden) {
      router.replace("/");
      return;
    }

    if (needsSession && !signedIn) {
      const target = `${pathname}${typeof window === "undefined" ? "" : window.location.search}`;
      router.replace(`/login?returnTo=${encodeURIComponent(safeReturnPath(target))}`);
      return;
    }

    /* Already signed in and standing on the sign-in screen: go where they were
       headed, or to the dashboard. Without this, a bookmarked /login is a dead
       end for someone whose session is perfectly good. */
    if (isPublicRoute(pathname) && signedIn && pathname === "/login") {
      const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
      router.replace(safeReturnPath(params.get("returnTo")));
    }
  }, [hidden, needsSession, pathname, router, signedIn, staffReady]);

  /* Nothing is painted until the session is known, and nothing behind the wall
     is painted to someone who is not through it. The blank is deliberate and
     brief: `GET /admin/auth/session` is one round trip on the same origin. */
  if (!staffReady) return <div className="aui-boot" />;
  if (needsSession && !signedIn) return <div className="aui-boot" />;
  /* Same rule as the wall above: do not paint one frame of a screen that is
     about to be left. */
  if (hidden) return <div className="aui-boot" />;

  return <>{children}</>;
}
