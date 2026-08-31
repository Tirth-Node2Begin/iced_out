"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to: the answer changes exactly once, at hydration. */
const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False while React is rendering the server's markup, true from the first
 * client render after hydration.
 *
 * The point is anything that must not act on a server-rendered guess — a route
 * guard reading a session, a control that depends on `window`. This app is
 * statically exported, so that markup was written at build time with no session
 * and no bag in it; a redirect fired on the strength of it is a redirect fired
 * on data that was never true.
 *
 * `useSyncExternalStore` rather than a `useEffect` that flips a flag: both
 * booleans are primitives, so the two snapshots stay referentially stable, and
 * it costs no state update and no extra render pass of its own.
 */
export function useHydrated() {
  return useSyncExternalStore(noSubscription, onClient, onServer);
}
