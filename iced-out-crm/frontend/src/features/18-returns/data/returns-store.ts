"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import { createIdempotencyKey } from "@/api/request-context";
import type { RecordRow } from "@/components/shell/record-manager";
import { refreshQueues } from "@/features/15-dashboard/dashboard-api";
import { createRemoteStore } from "@/lib/remote-store";

/**
 * The returns register, read from the database.
 *
 * It was a `localStorage` register seeded from fixtures. The doc comment it
 * carried was right about the problem it had already solved — the list and the
 * detail page now agreed — and wrong about the one it had not: both of them
 * agreed about a register that existed in one browser. A return a customer
 * actually raised reached nobody, and an approval an operator recorded went
 * nowhere near the order it was about.
 *
 * There is no create verb, and that is a correction rather than a gap. A return
 * is raised by a CUSTOMER against something they bought; an operator's job is to
 * decide on it. The API offers no `POST /admin/returns` for the same reason.
 *
 * Every verb is its own endpoint, because each does more than change a word:
 *
 *   approve          → moves it on and lets the pickup be arranged
 *   reject           → closes it, with a reason
 *   collect-payment  → takes the difference on an exchange that costs more
 *   settle           → issues the voucher, or releases the replacement
 *
 * The two that move money are marked replay-safe: a retried request must not
 * take the difference twice or issue two vouchers.
 */

const PATH = "/admin/returns";

const store = createRemoteStore<RecordRow>(async () => {
  const response = await adminClient.get<{ data: RecordRow[] }>(PATH);
  return response.data.data;
});

export type ReturnsRegister = {
  returns: RecordRow[];
  /** False until the endpoint has answered. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<RecordRow[]>;
  /** Agrees the return may come back. */
  approve: (id: string, body?: Record<string, unknown>) => Promise<void>;
  /** Refuses it, with a reason the customer is told. */
  reject: (id: string, body?: Record<string, unknown>) => Promise<void>;
  /** Takes the difference on an exchange that costs more. Replay-safe. */
  collectPayment: (id: string, body?: Record<string, unknown>) => Promise<void>;
  /** Closes it out — voucher issued, or replacement released. Replay-safe. */
  settle: (id: string, body?: Record<string, unknown>) => Promise<void>;
};

export function useReturnsRegister(): ReturnsRegister {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const act = useCallback(
    async (
      id: string,
      verb: string,
      body?: Record<string, unknown>,
      idempotent = false,
    ) => {
      const path = `${PATH}/${encodeURIComponent(id)}/${verb}`;

      await adminClient.post(
        path,
        body ?? {},
        idempotent
          ? { headers: { "Idempotency-Key": createIdempotencyKey(path) } }
          : undefined,
      );

      /* And the queue counts, which the rail's badges read. */
      await Promise.all([store.refresh(), refreshQueues()]);
    },
    [],
  );

  return useMemo(
    () => ({
      returns: state.data,
      ready: state.loaded,
      loading: state.loading,
      error: state.error,
      refresh: () => store.refresh(),
      approve: (id, body) => act(id, "approve", body),
      reject: (id, body) => act(id, "reject", body),
      collectPayment: (id, body) => act(id, "collect-payment", body, true),
      settle: (id, body) => act(id, "settle", body, true),
    }),
    [act, state],
  );
}

/** Drops the held register. Called on staff sign-out. */
export function resetReturns() {
  store.reset();
}
