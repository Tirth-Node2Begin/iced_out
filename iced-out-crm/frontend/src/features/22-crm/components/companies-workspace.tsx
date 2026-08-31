"use client";

import { Building2 } from "lucide-react";
import { useCallback, useMemo } from "react";

import { AdminPage, type StatusTone } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { crm, useCompanies, useOwners } from "@/features/22-crm/crm-api";
import type { Company } from "@/features/22-crm/types";

/**
 * Companies — the accounts contacts belong to and deals are billed against.
 *
 * A shop selling to individuals may never open this screen, and that is the
 * right outcome: a company is optional everywhere it appears. It earns its place
 * the first time a wholesale buyer, a stylist's agency or a press office is on
 * the other end of a conversation, because then "who else there do we know" and
 * "what have they bought overall" are questions with answers.
 */
function toRow(company: Company): RecordRow {
  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    industry: company.industry,
    sizeBand: company.sizeBand,
    email: company.email,
    phone: company.phone,
    website: company.website,
    city: company.city,
    state: company.state,
    country: company.country,
    status: company.status === "ACTIVE" ? "Active" : "Archived",
    statusCode: company.status,
    owner: company.owner?.name ?? "",
    ownerId: company.owner?.id ?? "",
    contacts: String(company.contactsCount),
    deals: String(company.openDeals),
    won: company.wonValue,
  };
}

const STATUS_TONES: Record<string, StatusTone> = { Active: "good", Archived: "idle" };

const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"];

export function CompaniesWorkspace() {
  /* `status: "all"` rather than the endpoint's own default of ACTIVE — the chips
     below need archived rows present to be able to filter to them. */
  const { companies, loading, error, loaded, reload } = useCompanies({ status: "all" });
  const { owners } = useOwners();

  const rows = useMemo(() => companies.map(toRow), [companies]);
  const after = useCallback(async () => {
    await reload();
  }, [reload]);

  const fields: FormField[] = useMemo(
    () => [
      { key: "name", label: "Name", required: true, full: true, placeholder: "Northside Retail" },
      { key: "domain", label: "Domain", placeholder: "northside.example" },
      { key: "industry", label: "Industry", placeholder: "Fashion retail" },
      {
        key: "sizeBand",
        label: "Size",
        type: "select",
        options: [{ value: "", label: "Not known" }, ...SIZE_BANDS.map((band) => ({ value: band, label: `${band} people` }))],
      },
      {
        key: "statusCode",
        label: "Status",
        type: "select",
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "ARCHIVED", label: "Archived" },
        ],
        initial: "ACTIVE",
        help: "Archiving keeps every contact, deal and note attached to it — it only takes the company out of the pickers.",
      },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website", full: true, placeholder: "https://northside.example" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
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
    ],
    [owners],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Company", primary: true, sub: "industry" },
      { key: "city", label: "Where", hideSmall: true },
      { key: "contacts", label: "People", numeric: true, align: "right" },
      { key: "deals", label: "Open deals", numeric: true, align: "right", hideSmall: true },
      { key: "won", label: "Won", numeric: true, align: "right", hideSmall: true },
      { key: "owner", label: "Owner", hideSmall: true },
      { key: "status", label: "Status", status: true },
    ],
    [],
  );

  return (
    <AdminPage
      eyebrow="Relationships"
      icon={Building2}
      lede="The accounts behind the people. A company is optional everywhere it appears — it earns its place the first time you need to know who else there you have spoken to."
      spec={[
        { label: "Companies", value: String(companies.length) },
        {
          label: "With open deals",
          value: String(companies.filter((company) => company.openDeals > 0).length),
        },
        {
          label: "Archived",
          value: String(companies.filter((company) => company.status === "ARCHIVED").length),
        },
      ]}
      title={
        <>
          Company <em>accounts</em>
        </>
      }
    >
      <RecordManager
        columns={columns}
        emptyHint="Converting a lead that named a company writes one of these automatically, so this register usually fills itself."
        error={error}
        fields={fields}
        filterKey="status"
        filterOrder={["Active", "Archived"]}
        filterValues={["Active", "Archived"]}
        icon={Building2}
        loaded={loaded}
        loading={loading}
        onCreate={async (values) => {
          await crm.createCompany({
            name: values.name,
            domain: values.domain,
            industry: values.industry,
            sizeBand: values.sizeBand,
            email: values.email,
            phone: values.phone,
            website: values.website,
            city: values.city,
            state: values.state,
            owner: values.ownerId,
          });
          await after();
        }}
        onDelete={async (row) => {
          await crm.deleteCompany(row.id);
          await after();
        }}
        onUpdate={async (values, previous) => {
          await crm.updateCompany(previous.id, {
            name: values.name,
            domain: values.domain,
            industry: values.industry,
            sizeBand: values.sizeBand,
            status: values.statusCode,
            email: values.email,
            phone: values.phone,
            website: values.website,
            city: values.city,
            state: values.state,
            owner: values.ownerId || "none",
          });
          await after();
        }}
        plural="companies"
        rowHref={(row) => `/companies/detail?id=${encodeURIComponent(row.id)}`}
        rows={rows}
        searchKeys={["id", "name", "domain", "industry", "city", "owner", "email"]}
        singular="Company"
        statusTone={(row) => STATUS_TONES[row.status]}
      />
    </AdminPage>
  );
}
