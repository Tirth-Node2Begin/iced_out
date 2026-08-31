"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { customerClient } from "@/api/clients";
import type { SupportQuery } from "@/features/14-support/data/support-queries";
import { createRemoteRecord } from "@/lib/remote-store";

/**
 * Support, on both sides of the desk.
 *
 * It was one `localStorage` list, with a comment saying that keeping it there was
 * what let "the shopper's page and the console see the same records". They did —
 * as long as both were tabs of the same browser on the same machine. A question a
 * real customer sent reached nobody, and a reply an operator wrote went to a
 * record only they could see.
 *
 * THE SHOPPER'S HALF ONLY. The desk an operator answers from is
 * `GET /admin/support/queries`, and that lives in the CRM now — with its own
 * copy of this file holding the other half. Two audiences, two deployments, one
 * `support_queries` table.
 *
 * What is left here:
 *
 *   `GET /me/support`      their threads, plus the topics they may pick
 *   `POST /support/queries` a new question
 *
 * The topics come from the server because they are a settings vocabulary the
 * CRM owns: one added there appears in the shopper's dropdown without a deploy,
 * and the form cannot offer one the server would refuse.
 */

/**
 * The shopper's own threads AND the topics they may pick, which arrive together
 * because the endpoint answers with both.
 *
 * A record rather than a list store for that reason, and a store rather than
 * component state filled by an effect for the usual one: the load belongs to the
 * store, so nothing setStates inside an effect body.
 */
type Inbox = { queries: SupportQuery[]; topics: string[] };

const inboxRecord = createRemoteRecord<Inbox>(async () => {
  const response = await customerClient.get<{ data: Inbox }>("/me/support");
  return response.data.data;
});

/* --------------------------------------------------------------- the shopper */

export type SupportInbox = {
  /** This shopper's own threads, newest first. */
  queries: SupportQuery[];
  /** What a query may be about — the server's vocabulary, not a local list. */
  topics: string[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** Sends one. Returns the record so the page can quote its reference. */
  send: (input: { topic: string; order: string; message: string }) => Promise<SupportQuery>;
  refresh: () => Promise<void>;
};

/**
 * @param enabled false while nobody is signed in — the endpoint needs a session,
 *   and asking without one is a 401 logged on every page load.
 */
export function useSupportInbox(enabled = true): SupportInbox {
  /* Reading the snapshot is what starts the request, so a signed-out visitor reads
     the server snapshot instead — the endpoint needs a session cookie, and asking
     without one is a 401 logged on every page load. */
  const state = useSyncExternalStore(
    inboxRecord.subscribe,
    enabled ? inboxRecord.getSnapshot : inboxRecord.getServerSnapshot,
    inboxRecord.getServerSnapshot,
  );

  const read = useCallback(async () => {
    if (enabled) await inboxRecord.reload();
  }, [enabled]);

  const send = useCallback(
    async (input: { topic: string; order: string; message: string }) => {
      const response = await customerClient.post<{ data: SupportQuery }>("/support/queries", {
        topic: input.topic,
        message: input.message,
        ...(input.order ? { order: input.order } : {}),
      });

      const query = response.data.data;

      /* Re-read so the reference the confirmation quotes is the record the
         server actually wrote.

         This used to drop the console's own queue as well, so an operator
         watching it saw the new thread without reloading. That call cannot do
         anything from here any more: the desk is a different origin in a
         different tab with its own module memory, so there is no store in this
         process to invalidate. The CRM re-reads `/admin/support/queries` on its
         next load and picks the thread up then — which is what actually
         happened before too, unless the operator and the shopper were the same
         person in the same browser. */
      await inboxRecord.reload();

      return query;
    },
    [],
  );

  return useMemo(
    () => ({
      queries: state.data?.queries ?? [],
      topics: state.data?.topics ?? [],
      ready: state.loaded,
      loading: state.loading,
      error: state.error,
      send,
      refresh: read,
    }),
    [read, send, state],
  );
}
