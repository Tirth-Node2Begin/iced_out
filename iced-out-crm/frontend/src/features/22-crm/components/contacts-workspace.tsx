"use client";

import { Contact as ContactIcon, Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Btn, type StatusTone } from "@/components/shell/admin-ui";
import { AdminPage } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { ImportCustomersDialog } from "@/features/22-crm/components/import-customers-dialog";
import {
  crm,
  useCompanyOptions,
  useContacts,
  useOwners,
  useRefreshCounts,
} from "@/features/22-crm/crm-api";
import {
  LIFECYCLE_LABELS,
  SOURCE_LABELS,
  type Contact,
  type Lifecycle,
} from "@/features/22-crm/types";

/**
 * Contacts — the people the shop knows, whether or not they have ever bought.
 *
 * The column that makes this list worth reading is `Orders`. A contact with six
 * behind them is a different conversation from one with none, and that number is
 * the whole reason the CRM shares a database with the shop rather than syncing
 * with it: nothing here was copied, and nothing can be stale.
 *
 * It counts orders matched by the account link OR by the frozen `contact_email`
 * on the order, so a customer whose purchases were all guest checkouts still
 * shows their history.
 */
function toRow(contact: Contact): RecordRow {
  return {
    id: contact.id,
    name: contact.name,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    lifecycle: LIFECYCLE_LABELS[contact.lifecycle] ?? contact.lifecycle,
    lifecycleCode: contact.lifecycle,
    source: SOURCE_LABELS[contact.source] ?? contact.source,
    sourceCode: contact.source,
    company: contact.company?.name ?? "",
    companyId: contact.company?.id ?? "",
    owner: contact.owner?.name ?? "",
    ownerId: contact.owner?.id ?? "",
    orders: String(contact.ordersCount),
    spend: contact.ordersTotal,
    deals: String(contact.openDeals),
    city: contact.city,
    state: contact.state,
    country: contact.country,
    customerId: contact.customerId ?? "",
    lastActivityAt: contact.lastActivityAt ?? "",
  };
}

const LIFECYCLE_ORDER = ["Subscriber", "Lead", "Qualified", "Customer", "Churned"];

const LIFECYCLE_TONES: Record<string, StatusTone> = {
  Subscriber: "idle",
  Lead: "info",
  Qualified: "warn",
  Customer: "good",
  Churned: "bad",
};

export function ContactsWorkspace() {
  const { contacts, loading, error, loaded, reload } = useContacts({});
  const { owners } = useOwners();
  const { companies } = useCompanyOptions();
  const refreshCounts = useRefreshCounts();
  const [importing, setImporting] = useState(false);

  const rows = useMemo(() => contacts.map(toRow), [contacts]);

  const after = useCallback(async () => {
    await reload();
    void refreshCounts();
  }, [refreshCounts, reload]);

  const fields: FormField[] = useMemo(
    () => [
      { key: "firstName", label: "First name", required: true },
      { key: "lastName", label: "Last name" },
      { key: "email", label: "Email", type: "email", full: true, placeholder: "aarav@example.com" },
      { key: "phone", label: "Phone", placeholder: "9876500011" },
      { key: "jobTitle", label: "Role", placeholder: "Buyer" },
      {
        key: "lifecycleCode",
        label: "Lifecycle",
        type: "select",
        options: (Object.keys(LIFECYCLE_LABELS) as Lifecycle[]).map((value) => ({
          value,
          label: LIFECYCLE_LABELS[value],
        })),
        initial: "LEAD",
        help: "Where this person is in their relationship with the shop. It is a judgement, not a computed field — buying something does not move it on its own.",
      },
      {
        key: "sourceCode",
        label: "Source",
        type: "select",
        options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
        initial: "OTHER",
      },
      {
        key: "companyId",
        label: "Company",
        type: "select",
        options: [
          { value: "none", label: "No company" },
          ...companies.map((company) => ({ value: company.id, label: company.name })),
        ],
        initial: "none",
        full: true,
      },
      {
        key: "ownerId",
        label: "Owner",
        type: "select",
        options: [
          { value: "none", label: "Unassigned" },
          ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
        ],
        initial: "none",
      },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
    ],
    [companies, owners],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Contact", primary: true, sub: "company" },
      { key: "email", label: "Email", hideSmall: true },
      { key: "phone", label: "Phone", hideSmall: true },
      { key: "orders", label: "Orders", numeric: true, align: "right" },
      { key: "spend", label: "Spend", numeric: true, align: "right", hideSmall: true },
      { key: "owner", label: "Owner", hideSmall: true },
      { key: "lifecycle", label: "Lifecycle", status: true },
    ],
    [],
  );

  const customers = contacts.filter((contact) => contact.lifecycle === "CUSTOMER").length;
  const linked = contacts.filter((contact) => contact.customerId !== null).length;

  return (
    <AdminPage
      actions={
        <Btn onClick={() => setImporting(true)} variant="ghost">
          <Download aria-hidden size={15} strokeWidth={1.7} /> Import from the shop
        </Btn>
      }
      eyebrow="Relationships"
      icon={ContactIcon}
      lede="Everyone the shop has a relationship with. Their orders come from the storefront's own register, so nothing here was copied and nothing can go stale."
      spec={[
        { label: "Contacts", value: String(contacts.length) },
        { label: "Customers", value: String(customers) },
        { label: "Linked to an account", value: String(linked) },
      ]}
      title={
        <>
          The <em>address book</em>
        </>
      }
    >
      <RecordManager
        columns={columns}
        emptyHint="Import the people who have already bought something, or add a contact by hand — a wholesale buyer or a stylist has no storefront account to import."
        error={error}
        fields={fields}
        filterKey="lifecycle"
        filterOrder={LIFECYCLE_ORDER}
        filterValues={LIFECYCLE_ORDER}
        icon={ContactIcon}
        loaded={loaded}
        loading={loading}
        onCreate={async (values) => {
          await crm.createContact({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone,
            jobTitle: values.jobTitle,
            lifecycle: values.lifecycleCode,
            source: values.sourceCode,
            company: values.companyId,
            owner: values.ownerId,
            city: values.city,
            state: values.state,
          });
          await after();
        }}
        onDelete={async (row) => {
          await crm.deleteContact(row.id);
          await after();
        }}
        onUpdate={async (values, previous) => {
          await crm.updateContact(previous.id, {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone,
            jobTitle: values.jobTitle,
            lifecycle: values.lifecycleCode,
            source: values.sourceCode,
            company: values.companyId || "none",
            owner: values.ownerId || "none",
            city: values.city,
            state: values.state,
          });
          await after();
        }}
        plural="contacts"
        rowHref={(row) => `/contacts/detail?id=${encodeURIComponent(row.id)}`}
        rows={rows}
        searchKeys={["id", "name", "email", "phone", "company", "owner", "jobTitle"]}
        singular="Contact"
        statusTone={(row) => LIFECYCLE_TONES[row.lifecycle]}
      />

      {importing && (
        <ImportCustomersDialog
          onClose={() => setImporting(false)}
          onDone={async (result) => {
            setImporting(false);
            await after();
            toast.success(
              result.created === 0
                ? "Nothing new to import."
                : `${result.created} contact${result.created === 1 ? "" : "s"} imported.`,
              {
                description:
                  result.skipped > 0
                    ? `${result.skipped} already had a contact record and were left alone.`
                    : undefined,
              },
            );
          }}
          owners={owners}
        />
      )}
    </AdminPage>
  );
}
