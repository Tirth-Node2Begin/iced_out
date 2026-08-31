"use client";

import { useMemo } from "react";

import { useRegister, type Register } from "@/api/use-register";
import type { RecordRow } from "@/components/shell/record-manager";

/**
 * The customer register, read from the database.
 *
 * It was a `localStorage` book seeded from `customers-data.ts`, and the seam that
 * created was the sharpest in the console: a shopper who registered on the
 * storefront wrote a row to `users`, and this screen — the one an operator opens
 * to answer "who is this person" — could not see them. It listed eight invented
 * customers instead, with invented lifetime values.
 *
 * `orders` and `value` are COUNTED by the server from the orders that customer
 * actually placed, which is why neither is a field on the form. They used to be
 * editable numbers a new record was seeded with.
 */
export type CustomersValue = {
  customers: RecordRow[];
  /** False until the endpoint has answered. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  register: Register;
};

export function useCustomers(): CustomersValue {
  const customers = useRegister(
    useMemo(
      () => ({
        path: "/admin/customers",
        itemPath: (row: RecordRow) => `/admin/customers/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          name: values.name,
          email: values.email,
          phone: values.phone ?? "",
        }),
        /**
         * The email is deliberately absent.
         *
         * It is how an account signs in, so changing it is changing who can reach
         * the account — not a field on a register row. The API's PATCH does not
         * accept it either; this is the client half of the same decision.
         */
        toUpdate: (values: RecordRow) => ({
          name: values.name,
          phone: values.phone ?? "",
          state: values.state,
        }),
      }),
      [],
    ),
  );

  return useMemo(
    () => ({
      customers: customers.rows,
      ready: customers.loaded,
      loading: customers.loading,
      error: customers.error,
      register: customers,
    }),
    [customers],
  );
}
