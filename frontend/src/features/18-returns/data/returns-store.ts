"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { RecordRow } from "@/components/admin/record-manager";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";
import { createLocalStore } from "@/lib/local-store";

/**
 * The returns register, kept somewhere that outlives the page.
 *
 * It used to be a `useState` seeded from the fixtures, which made the screen a
 * demonstration rather than a register: approving a return, collecting a
 * difference, creating one — all of it died on the next navigation, and the
 * detail page went on showing the fixture's state while the list showed the
 * truth. Two screens about one return, disagreeing.
 *
 * One store fixes both. The list and the detail page read the same rows, and
 * `localStorage` carries them across a reload and between tabs, exactly as the
 * payment ledger and the voucher ledger already do.
 *
 * There is no provider: the store is a module singleton, so any screen can read
 * it without another being mounted.
 */

type Register = { returns: RecordRow[] };

/**
 * Bumped when the state vocabulary changes. `Awaiting payment` arrived with
 * automatic collection on exchanges — the states ARE the schema here, since
 * every row action keys off them, so a register written under the old words
 * would come back holding rows no button could move.
 */
const STORAGE_KEY = "iced-out-returns-v2";

const SEEDED: Register = { returns: adminReturnFixtures };

/** Only flat string maps survive the trip back — anything else is not a record. */
function reviveList(value: unknown, fallback: RecordRow[]): RecordRow[] {
  if (!Array.isArray(value)) return fallback;

  const rows: RecordRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row: RecordRow = {};
    for (const [key, cell] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof cell === "string") row[key] = cell;
    }
    if (row.id) rows.push(row);
  }

  return rows;
}

const store = createLocalStore<Register>(STORAGE_KEY, SEEDED, (parsed, fallback) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const stored = parsed as Partial<Record<keyof Register, unknown>>;

  /* An emptied register is a legitimate state, so a missing key falls back to
     the seed but a present-and-empty one is honoured. */
  return {
    returns: "returns" in stored ? reviveList(stored.returns, []) : fallback.returns,
  };
});

/**
 * The next free `ret-0NN`, counted across the WHOLE register.
 *
 * Minted here rather than by the list component, because that one only ever
 * sees the tab it is on: a register asked for a free id while showing only the
 * exchanges would happily mint one a voucher return already holds, and the two
 * rows would then be the same record to every lookup in the app.
 */
export function mintReturnId(rows: RecordRow[]) {
  const taken = new Set(rows.map((row) => row.id));

  let count = 1;
  let id = `ret-${String(count).padStart(3, "0")}`;
  while (taken.has(id)) {
    count += 1;
    id = `ret-${String(count).padStart(3, "0")}`;
  }
  return id;
}

export type ReturnsRegister = {
  returns: RecordRow[];
  /**
   * Applies one change to the register. It takes an updater rather than a list
   * because an undo can fire long after the render that offered it, and it
   * still has to build on what is current — which the store, not the closure,
   * knows.
   */
  commit: (next: (current: RecordRow[]) => RecordRow[]) => void;
  /** Writes one row by id, for a screen that only ever holds the one. */
  patch: (id: string, values: RecordRow) => void;
};

export function useReturnsRegister(): ReturnsRegister {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const commit = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ returns: next(current.returns) });
  }, []);

  const patch = useCallback(
    (id: string, values: RecordRow) => {
      commit((current) => current.map((row) => (row.id === id ? { ...row, ...values } : row)));
    },
    [commit],
  );

  return { returns: state.returns, commit, patch };
}
