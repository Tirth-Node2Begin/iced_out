import { RouteLoading } from "@/components/layout/route-loading";

/**
 * One boundary at the root covers every route.
 *
 * Each route group could carry its own, but they would all render the same
 * thing: the groups differ in chrome, and the chrome is exactly what is not
 * available yet when a chunk is still arriving. A single boundary here is the
 * whole of the app's answer to "clicked, nothing on screen yet".
 */
export default function Loading() {
  return <RouteLoading />;
}
