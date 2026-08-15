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

const publicStaffPaths = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, sessionReady, staffSession } = useAuth();
  const rule = getRouteRule(pathname);
  const isPublicStaffPath = publicStaffPaths.has(pathname);
  const customerAllowed = rule?.audience !== "customer" || isAuthenticated;
  /* One question, not two. There is a single staff role, so holding a session
     is the whole of authorisation — there is no longer a state where someone
     is signed in and still turned away, which is why the 403 went with it. */
  const staffAllowed =
    rule?.audience !== "staff" || isPublicStaffPath || Boolean(staffSession);
  const allowed = customerAllowed && staffAllowed;

  /* `sessionReady` gates both redirects.
     The page is served as static HTML with no session in it, so `isAuthenticated`
     is false on the first render whether or not the shopper is signed in — acting
     on that reading is what sent a signed-in shopper to the login page on every
     reload of the bag, checkout or account. The stored session is one render
     away; this waits for it.

     The staff branch used to skip the wait, on the grounds that a staff session
     was never restored and so there was nothing to wait for. It is restored now
     — out of `sessionStorage`, for fifteen minutes — and it reaches this guard
     by the same route, one render after the hydrating one. Without the wait,
     every reload of an admin screen redirected to `/admin/login` before the
     session it already had could be read. */
  useEffect(() => {
    if (allowed || !rule) return;
    if (!sessionReady) return;

    /* The query comes along. A screen addressed by one — the product editor is
       `…/products/edit?id=<slug>` — is a different destination for every id,
       and a return path that kept only the pathname sent an operator back to
       an editor with nothing in it. Read off `location` rather than
       `useSearchParams`, which would suspend this guard and, since it mounts
       above every route, opt the whole app out of prerendering. */
    const returnTo = encodeURIComponent(`${pathname}${window.location.search}`);
    if (rule.audience === "customer") router.replace(`/auth/login?returnTo=${returnTo}`);
    else router.replace(`/admin/login?returnTo=${returnTo}`);
  }, [allowed, pathname, router, rule, sessionReady]);

  /* Nothing is painted while the redirect above runs. The wait is a frame or
     two, and a screen announcing it read as a refusal that had not happened —
     worse than the blank it replaced. The route is still withheld: children
     only mount once the rule allows them. */
  if (!allowed && rule) return null;

  return children;
}
