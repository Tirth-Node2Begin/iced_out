"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient, customerClient } from "@/api/clients";
import { refreshQueues } from "@/features/15-dashboard/dashboard-api";
import type { SupportQuery } from "@/features/14-support/data/support-queries";
import { createRemoteRecord, createRemoteStore } from "@/lib/remote-store";

/**
 * Support, on both sides of the desk.
 *
 * It was one `localStorage` list, with a comment saying that keeping it there was
 * what let "the shopper's page and the console see the same records". They did —
 * as long as both were tabs of the same browser on the same machine. A question a
 * real customer sent reached nobody, and a reply an operator wrote went to a
 * record only they could see.
 *
 * Two audiences, two endpoints, one table:
 *
 *   the shopper — `GET /me/support` (their threads, plus the topics they may
 *                 pick) and `POST /support/queries`
 *   the console — `GET /admin/support/queries`, with `resolve` and `reopen`
 *
 * The topics come from the server because they are a settings vocabulary the
 * console owns: one added there appears in the shopper's dropdown without a
 * deploy, and the form cannot offer one the server would refuse.
 */

/** The console's queue. Shared by every screen in `/admin/support`. */
const consoleStore = createRemoteStore<SupportQuery>(async () => {
  const response = await adminClient.get<{ data: SupportQuery[] }>("/admin/support/queries");
  return response.data.data;
});

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

      /* Re-read so the reference the confirmation quotes is the record the server
         actually wrote, and the console's own queue is dropped so an operator
         watching it sees the new thread on its next read rather than after a
         manual reload. */
      await inboxRecord.reload();
      consoleStore.reset();

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
