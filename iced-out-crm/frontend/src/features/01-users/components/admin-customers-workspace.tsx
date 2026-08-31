"use client";

import { IndianRupee, UserCheck, Users } from "lucide-react";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { AdminPage, Note } from "@/components/shell/admin-ui";
import { RecordManager, type Column, type FormField } from "@/components/shell/record-manager";
import { CUSTOMER_STATES, moneyValue, rupees } from "@/features/01-users/customers-data";
import { useCustomers } from "@/features/01-users/customers-store";

/**
 * The customer register.
 *
 * One table answering the three questions an operator actually opens this
 * screen with: who is this person, how do I reach them, and what have they
 * spent. Anything owned by another module — the return in QC, the open payment
 * ticket — is read there, not mirrored into a customer's state here.
 *
 * The rows are the shared register, so a shopper signing in on the storefront
 * appears here without anybody typing them in.
 */
const COLUMNS: Column[] = [
  { key: "name", label: "Customer", primary: true, sub: "id" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone", hideSmall: true },
  { key: "seen", label: "Last signed in", hideSmall: true },
  { key: "orders", label: "Orders", align: "right", numeric: true },
  { key: "value", label: "Lifetime value", align: "right", numeric: true },
  { key: "state", label: "State", status: true },
];

/**
 * What a new customer is asked for — the person, and nothing else.
 *
 * The id is minted by the server, and orders and lifetime value are counted from
 * what they have actually bought. None of the three is something an operator
 * should be typing.
 */
const FIELDS: FormField[] = [
  { key: "name", label: "Full name", placeholder: "Aarav Kapoor", required: true },
  { key: "email", label: "Email", placeholder: "aarav.kapoor@example.com", required: true },
  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  {
    key: "state",
    label: "State",
    type: "select",
    options: CUSTOMER_STATES,
    initial: "Active",
    help: "Blocked customers keep their history but cannot place new orders.",
  },
];

export function AdminCustomersWorkspace() {
  const { customers: rows, register, ready, loading, error } = useCustomers();

  const active = rows.filter((row) => row.state === "Active").length;
  const lifetime = rows.reduce((sum, row) => sum + moneyValue(row.value), 0);

  /* Read off the table rather than written beside it, so adding or blocking a
     customer moves these in the same breath as the row. */
  const stats: Stat[] = [
    { label: "Customers", value: String(rows.length), icon: Users, tone: "sky" },
    {
      label: "Active",
      value: String(active),
      icon: UserCheck,
      tone: "mint",
      note: `${rows.length - active} blocked`,
    },
    {
      label: "Lifetime value",
      value: rupees(lifetime),
      icon: IndianRupee,
      tone: "violet",
      note: "Across every customer",
    },
  ];

  return (
    <AdminPage
      eyebrow="Customers"
      icon={Users}
      lede="Everyone who has an account with the shop. Search for a person, open them to see what they have bought, or block an account without losing its history."
      title={
        <>
          Customer <em>register</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      <RecordManager
        columns={COLUMNS}
        emptyHint="Nobody has an account yet. They appear here as people register on the storefront."
        error={error}
        fields={FIELDS}
        filterKey="state"
        filterValues={CUSTOMER_STATES}
        icon={Users}
        loaded={ready}
        loading={loading}
        onCreate={register.onCreate}
        onUpdate={register.onUpdate}
        /* No delete. An account is a person, and their orders, returns and
           payments all point at it — there is no endpoint to remove one, and
           there should not be. Blocking is the verb, and it keeps the history. */
        rowHref={(row) => `/customers/detail?id=${encodeURIComponent(row.id)}`}
        rows={rows}
        singular="customer"
        tone="sky"
        /* A first answer only. The server holds the unique index on the email and
           has the whole table to check against, not just the page in front of us. */
        validate={(values, current, previous) =>
          current.some(
            (row) =>
              row.id !== previous?.id &&
              row.email.toLowerCase() === (values.email ?? "").toLowerCase(),
          )
            ? "Another customer already uses that email address."
            : null
        }
      >
        <Note icon={UserCheck} title="This register fills itself">
          Anyone who signs in or creates an account on the storefront lands here automatically, with
          the time they were last seen. Add someone by hand only when they never signed in
          themselves — a phone order, a walk-in.
        </Note>
      </RecordManager>
    </AdminPage>
  );
}
