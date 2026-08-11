import { StatusActions } from "@/components/layout/status-actions";

import "@/styles/components/status.css";

/**
 * The staff 403 — where `<RouteGuard>` sends an operator who holds a session
 * but not the permission a route demands (see `config/route-rules.ts`; the
 * guard's third branch is `router.replace("/admin/forbidden")`).
 *
 * Same flat treatment as the 404, and for the same reason: this is a verdict,
 * not a document. The operator does not need the policy explained on screen —
 * they need to know they were stopped and to get somewhere they are allowed to
 * be. The audit trail lives in the log, which is where it is actually useful.
 *
 * "Back to admin" rather than the store: the person reading this is signed in
 * as staff, and `/admin` resolves to the first page their role can reach.
 */
export default function ForbiddenPage() {
  return (
    <main className="st">
      <p className="st__figure" aria-hidden="true">
        403
      </p>

      <h1 className="sr-only">Access denied</h1>

      <StatusActions homeHref="/admin" homeLabel="Back to admin" />
    </main>
  );
}
