"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { RecordRow } from "@/components/admin/record-manager";
import { createLocalStore } from "@/lib/local-store";
import {
  CUSTOMER_SEED,
  nameFromEmail,
  nextCustomerId,
  rupees,
  stampNow,
} from "@/features/01-users/customers-data";

/**
 * The one copy of the customer register.
 *
 * The storefront writes to it and the console reads it: a shopper who signs in
 * at `/auth/login` is in `/admin/customers` on the operator's next look, and an
 * operator blocking an account is writing the same record the storefront just
 * touched. There is no backend yet, so this stands in for the customers table —
 * the same shape a `GET /customers` would return, held in localStorage so it
 * survives a reload and reaches every open tab.
 *
 * Email is the identity. A second sign-in with an address already on file
 * touches the existing row rather than minting a duplicate.
 */
const STORAGE_KEY = "iced-out.customers-v1";

type Registry = { customers: RecordRow[] };

const store = createLocalStore<Registry>(STORAGE_KEY, { customers: CUSTOMER_SEED });

function current() {
  return store.getSnapshot().customers;
}

function matches(row: RecordRow, email: string) {
  return (row.email ?? "").trim().toLowerCase() === email;
}

export type SignInIdentity = { email: string; name?: string; phone?: string };

/**
 * Records a storefront sign-in.
 *
 * A returning shopper only moves their "last seen" — and keeps their state, so
 * an account an operator blocked stays blocked when its owner signs in again.
 * A new one joins the register with nothing bought yet.
 */
export function recordCustomerSignIn({ email, name, phone }: SignInIdentity) {
  const address = email.trim().toLowerCase();
  if (!address) return;

  const rows = current();
  const seen = stampNow();
  const known = rows.find((row) => matches(row, address));

  if (known) {
    store.write({
      customers: rows.map((row) =>
        matches(row, address)
          ? {
              ...row,
              /* Only ever filled in, never blanked: a sign-in that carries no
                 name must not wipe the one the register already has. */
              name: name?.trim() || row.name,
              phone: phone?.trim() || row.phone,
              seen,
            }
          : row,
      ),
    });
    return;
  }

  store.write({
    customers: [
      {
        id: nextCustomerId(rows),
        name: name?.trim() || nameFromEmail(address),
        email: address,
        phone: phone?.trim() ?? "",
        orders: "0",
        value: rupees(0),
        state: "Active",
        seen,
      },
      ...rows,
    ],
  });
}

/** The register, live. Re-renders on a sign-in here or in another tab. */
export function useCustomers() {
  const registry = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  /* Takes an updater rather than a list because an undo can fire long after the
     render that offered it, and it still has to build on what is current. */
  const commit = useCallback((next: (rows: RecordRow[]) => RecordRow[]) => {
    store.write({ customers: next(current()) });
  }, []);

  return { customers: registry.customers, commit };
}
