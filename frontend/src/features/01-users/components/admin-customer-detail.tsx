"use client";

import { IndianRupee, Mail, Package, ShieldCheck, Users } from "lucide-react";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Note, Section } from "@/components/admin/admin-ui";
import { RecordManager, type Column } from "@/components/admin/record-manager";
import { customerOrders } from "@/features/01-users/customers-data";
import { useCustomers } from "@/features/01-users/customers-store";

/**
 * One customer.
 *
 * Who they are, what they have spent, and every order behind that figure. The
 * history is read-only on purpose: an order is created and moved in
 * `/admin/orders`, and a second place to type one is a second place for the two
 * to disagree.
 */
const COLUMNS: Column[] = [
  { key: "id", label: "Order", primary: true, sub: "placed" },
  { key: "pieces", label: "Pieces", align: "right", numeric: true },
  { key: "value", label: "Value", align: "right", numeric: true },
  { key: "status", label: "State", status: true },
];

export function AdminCustomerDetail({ customerId }: { customerId: string }) {
  const { customers } = useCustomers();
  const customer = customers.find((row) => row.id === customerId);
  const orders = customerOrders(customerId);

  const name = customer?.name ?? customerId;
  const value = customer?.value ?? "₹0";
  const state = customer?.state ?? "Active";

  const stats: Stat[] = [
    { label: "Orders", value: String(orders.length), icon: Package, tone: "sky" },
    { label: "Lifetime value", value, icon: IndianRupee, tone: "violet" },
    {
      label: "State",
      value: state,
      icon: ShieldCheck,
      tone: state === "Active" ? "mint" : "amber",
      note: state === "Active" ? "Can place orders" : "Cannot place new orders",
    },
  ];

  return (
    <AdminPage
      back={{ href: "/admin/customers", label: "Customers" }}
      eyebrow="Customer record"
      icon={Users}
      lede="Everything this customer has bought, newest first."
      title={
        <>
          Customer <em>{name}</em>
        </>
      }
    >
      <StatGrid stats={stats} />

      {/* A shopper recorded from a storefront sign-in has an email and nothing
          else yet, so the contact line is joined from what is actually there
          rather than printing a separator with a blank after it. */}
      <Note
        icon={Mail}
        title={customer ? [customer.email, customer.phone].filter(Boolean).join(" · ") : customerId}
      >
        {customer
          ? `Customer id ${customer.id}${customer.seen ? `, last signed in ${customer.seen}` : ""}. Use these details to reach them about an order.`
          : "This customer is not in the register — they may have been deleted, or the link is stale."}
      </Note>

      <Section eyebrow="History" title="Orders">
        <RecordManager
          columns={COLUMNS}
          emptyHint="This customer has not placed an order yet."
          fields={[]}
          filterKey="status"
          icon={Package}
          initial={orders}
          readOnly
          rowHref={(row) => `/admin/orders/${row.id}`}
          singular="order"
          tone="sky"
        />
      </Section>
    </AdminPage>
  );
}
