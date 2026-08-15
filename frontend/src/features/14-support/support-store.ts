"use client";

import { useSyncExternalStore } from "react";

import { supportQuerySeed, type SupportQuery } from "@/features/14-support/data/support-queries";
import { createLocalStore } from "@/lib/local-store";

/**
 * The one list both sides of support read.
 *
 * It is kept in `localStorage` so the shopper's page and the console see the
 * same records: send a query in one tab, open `/admin/support` in another, and
 * it is already there — and the reply written there comes straight back.
 */
type Stored = { queries: SupportQuery[] };

const store = createLocalStore<Stored>("iced-out.support-queries", {
  queries: supportQuerySeed,
});

/** Every query, newest first. Re-renders wherever it is read. */
export function useSupportQueries(): SupportQuery[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
    .queries;
}

function update(change: (queries: SupportQuery[]) => SupportQuery[]) {
  store.write({ queries: change(store.getSnapshot().queries) });
}

/** `IO-Q-1004` after `IO-Q-1003`, whatever order the list happens to be in. */
function nextReference(queries: SupportQuery[]) {
  const highest = queries.reduce((top, query) => {
    const number = Number(query.reference.replace(/\D/g, ""));
    return Number.isFinite(number) && number > top ? number : top;
  }, 1000);
  return `IO-Q-${highest + 1}`;
}

function stamp() {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** The shopper sends one. Returns the record so the page can quote its reference. */
export function sendSupportQuery(input: {
  customer: string;
  email: string;
  topic: string;
  order: string;
  message: string;
}): SupportQuery {
  const queries = store.getSnapshot().queries;
  const query: SupportQuery = {
    reference: nextReference(queries),
    ...input,
    sentAt: stamp(),
    status: "Open",
    reply: "",
  };

  store.write({ queries: [query, ...queries] });
  return query;
}

/** The admin answers one. Answering IS resolving it — there is no third state. */
export function resolveSupportQuery(reference: string, reply: string) {
  update((queries) =>
    queries.map((query) =>
      query.reference === reference ? { ...query, reply, status: "Resolved" } : query,
    ),
  );
}

/** Undo, for a query closed too early. The reply written so far is kept. */
export function reopenSupportQuery(reference: string) {
  update((queries) =>
    queries.map((query) =>
      query.reference === reference ? { ...query, status: "Open" } : query,
    ),
  );
}
