"use client";

import { LockKeyhole } from "lucide-react";
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
  "/admin/forbidden",
]);

export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, sessionReady, staffSession, can } = useAuth();
  const rule = getRouteRule(pathname);
  const isPublicStaffPath = publicStaffPaths.has(pathname);
  const customerAllowed = rule?.audience !== "customer" || isAuthenticated;
  const staffAllowed =
    rule?.audience !== "staff" ||
    isPublicStaffPath ||
    Boolean(staffSession && (!rule.permission || can(rule.permission)));
  const allowed = customerAllowed && staffAllowed;

  /* `sessionReady` gates the customer redirect and nothing else.
     The page is served as static HTML with no session in it, so `isAuthenticated`
     is false on the first render whether or not the shopper is signed in — acting
     on that reading is what sent a signed-in shopper to the login page on every
     reload of the bag, checkout or account. The stored session is one effect
     away; this waits for it. Staff sessions are never restored, so there is
     nothing for the staff branch to wait on. */
  useEffect(() => {
    if (allowed || !rule) return;
    if (rule.audience === "customer" && !sessionReady) return;

    const returnTo = encodeURIComponent(pathname);
    if (rule.audience === "customer") router.replace(`/auth/login?returnTo=${returnTo}`);
    else if (!staffSession) router.replace(`/admin/login?returnTo=${returnTo}`);
    else router.replace("/admin/forbidden");
  }, [allowed, pathname, router, rule, sessionReady, staffSession]);

  /* The blocking state, in the same flat language as the 404 and the 403.
     It carries no figure, though: this is a wait, not a verdict, and a numeral
     the size of those would announce a refusal that has not happened — most of
     the time the effect above replaces this route within a frame or two.

     So it is the mark, breathing, and one line. No buttons: there is nothing
     for the visitor to decide here, and offering "go back" mid-redirect would
     race the redirect it is sitting in front of.

     `aria-live="polite"` stays on the <main> and the announced text stays a
     single sentence — the mark is decorative and hidden from the announcement,
     so a screen reader hears one clear status rather than fragments. */
  if (!allowed && rule) {
    return (
      <main className="route-guard" aria-live="polite">
        <LockKeyhole
          aria-hidden="true"
          className="route-guard__mark"
          size={30}
          strokeWidth={1.5}
        />
        <p className="st__label">Verifying access</p>
      </main>
    );
  }

  return children;
}
