"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import "@/styles/components/status.css";

import { getRouteRule } from "@/config/route-rules";
import { useAuth } from "@/features/20-auth-security/auth-context";

/* The guard mounts from the root providers, above every route group, so the
   stylesheet imported here lands in every route's CSS — which is also how the
   five auth Suspense fallbacks get painted, since they render
   `<main class="route-guard">` and import nothing themselves. The sheet has to
   be self-contained for the same reason: nothing above this component opens
   `.io-scope`, and that is where the storefront's token layer lives. */

/**
 * The shopper's wall.
 *
 * The staff branch is gone. It used to hold a second audience, three public
 * `/admin/*` paths and its own redirect target, because this app served the
 * operations console as well as the shop. The console is the CRM now — its own
 * site, its own origin, its own session cookie and its own copy of this
 * component — so there is exactly one audience left here.
 *
 * A `/admin/*` path on the storefront is a 404 rather than a gated route, which
 * is the honest answer: this deployment has no such screens to gate.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, sessionReady } = useAuth();
  const rule = getRouteRule(pathname);
  const allowed = rule === undefined || isAuthenticated;

  /* `sessionReady` gates the redirect.
     The page is served as static HTML with no session in it, so `isAuthenticated`
     is false on the first render whether or not the shopper is signed in — acting
     on that reading is what sent a signed-in shopper to the login page on every
     reload of the bag, checkout or account. The stored session is one render
     away; this waits for it. */
  useEffect(() => {
    if (allowed || !rule) return;
    if (!sessionReady) return;

    /* The query comes along. A screen addressed by one is a different
       destination for every id, and a return path that kept only the pathname
       sent a shopper back to an empty screen. Read off `location` rather than
       `useSearchParams`, which would suspend this guard and, since it mounts
       above every route, opt the whole app out of prerendering. */
    const returnTo = encodeURIComponent(`${pathname}${window.location.search}`);
    router.replace(`/auth/login?returnTo=${returnTo}`);
  }, [allowed, pathname, router, rule, sessionReady]);

  /* Nothing is painted while the redirect above runs. The wait is a frame or
     two, and a screen announcing it read as a refusal that had not happened —
     worse than the blank it replaced. The route is still withheld: children
     only mount once the rule allows them. */
  if (!allowed && rule) return null;

  return children;
}
