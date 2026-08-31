"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { refreshQueues } from "@/features/15-dashboard/dashboard-api";
import type { SupportQuery } from "@/features/14-support/data/support-queries";
import { createRemoteStore } from "@/lib/remote-store";

/**
 * Support, on both sides of the desk.
 *
 * It was one `localStorage` list, with a comment saying that keeping it there was
 * what let "the shopper's page and the console see the same records". They did —
 * as long as both were tabs of the same browser on the same machine. A question a
 * real customer sent reached nobody, and a reply an operator wrote went to a
 * record only they could see.
 *
 * THE DESK ONLY. The shopper's own inbox — `GET /me/support` and
 * `POST /support/queries` — belongs to the storefront, which has its own copy of
 * this file holding that half. Two audiences, two deployments, one
 * `support_queries` table.
 *
 * What is left here: `GET /admin/support/queries`, with `resolve` and `reopen`.
 * Answering IS resolving, so the store has one verb for it rather than two.
 */

/** The console's queue. Shared by every screen in `/admin/support`. */
const consoleStore = createRemoteStore<SupportQuery>(async () => {
  const response = await adminClient.get<{ data: SupportQuery[] }>("/admin/support/queries");
  return response.data.data;
});

/* --------------------------------------------------------------- the console */

export type SupportDesk = {
  queries: SupportQuery[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** Answering IS resolving — the store has one verb here, not two. */
  resolve: (reference: string, reply: string) => Promise<void>;
  /** Undo, for a query closed too early. The reply written so far is kept. */
  reopen: (reference: string) => Promise<void>;
};

export function useSupportDesk(): SupportDesk {
  const state = useSyncExternalStore(
    consoleStore.subscribe,
    consoleStore.getSnapshot,
    consoleStore.getServerSnapshot,
  );

  const act = useCallback(async (reference: string, verb: string, body?: unknown) => {
    await adminClient.post(
      `/admin/support/queries/${encodeURIComponent(reference)}/${verb}`,
      body ?? {},
    );
    /* And the queue counts, which the rail's badges read. */
    await Promise.all([consoleStore.refresh(), refreshQueues()]);
  }, []);

  return useMemo(
    () => ({
      queries: state.data,
      ready: state.loaded,
      loading: state.loading,
      error: state.error,
      resolve: (reference, reply) => act(reference, "resolve", { reply }),
      reopen: (reference) => act(reference, "reopen"),
    }),
    [act, state],
  );
}
