import { RouteLoading } from "@/components/layout/route-loading";

/**
 * One boundary at the root covers every route the console does not.
 *
 * On the storefront the chrome belongs to the page being replaced, so there is
 * nothing to preserve across the gap and a full-viewport surface is the right
 * answer to "clicked, nothing on screen yet".
 *
 * The admin console is the exception, and it carries its own boundaries
 * (`(admin)/admin/loading.tsx` and one per area). Its rail and topbar live in a
 * layout that outlives every navigation inside it — blanking them from up here
 * would take the menu away from the operator mid-click.
 */
export default function Loading() {
  return <RouteLoading />;
}
