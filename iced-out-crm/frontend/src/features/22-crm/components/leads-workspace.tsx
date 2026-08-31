"use client";

import { Sparkles, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPage, type StatusTone } from "@/components/shell/admin-ui";
import {
  RecordManager,
  type Column,
  type FormField,
  type RecordRow,
} from "@/components/shell/record-manager";
import { ConvertLeadDialog } from "@/features/22-crm/components/convert-lead-dialog";
import { crm, useLeads, useOwners, useRefreshCounts } from "@/features/22-crm/crm-api";
import {
  LEAD_STATUS_LABELS,
  SOURCE_LABELS,
  type Lead,
  type LeadStatus,
} from "@/features/22-crm/types";

/**
 * Leads — inbound interest, before anyone has decided whether it is worth a
 * record.
 *
 * The register loads the whole list and filters in the browser, the same as
 * every other register in this console. The endpoint DOES take
 * `?status=&source=&owner=&q=`, and the dashboard and the detail views use it —
 * but a filter that costs a round trip makes the chips feel broken at ten rows,
 * and ten rows is what a shop of this size has. When that stops being true the
 * change is to pass the chip's value into `useLeads`, and nothing else moves.
 */

/** The wire's SCREAMING_CASE flattened into what the table reads. */
function toRow(lead: Lead): RecordRow {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    source: SOURCE_LABELS[lead.source] ?? lead.source,
    sourceCode: lead.source,
    status: LEAD_STATUS_LABELS[lead.status] ?? lead.status,
    statusCode: lead.status,
    score: String(lead.score),
    message: lead.message,
    owner: lead.owner?.name ?? "",
    ownerId: lead.owner?.id ?? "",
    age: lead.age,
    createdAt: lead.createdAt ?? "",
    contactId: lead.convertedContactId ?? "",
    dealId: lead.convertedDealId ?? "",
  };
}

const STATUS_ORDER = ["New", "Contacted", "Qualified", "Unqualified", "Converted"];

/**
 * A lead's status is not a health reading, so the tones say something narrower
 * than good/bad: converted is done, unqualified is closed, and the three in
 * between are just how far along it is.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  New: "info",
  Contacted: "warn",
  Qualified: "info",
  Unqualified: "idle",
  Converted: "good",
};

export function LeadsWorkspace() {
  /* No filters passed: see the note at the top of the file. */
  const { leads, loading, error, loaded, reload } = useLeads({});
  const { owners } = useOwners();
  const refreshCounts = useRefreshCounts();
  const [converting, setConverting] = useState<Lead | null>(null);

  const rows = useMemo(() => leads.map(toRow), [leads]);

  const after = useCallback(async () => {
    await reload();
    /* The rail's Leads badge counts what is still open, so it changes on every
       one of these. */
    void refreshCounts();
  }, [refreshCounts, reload]);

  const fields: FormField[] = useMemo(
    () => [
      { key: "name", label: "Name", required: true, full: true, placeholder: "Aarav Kapoor" },
      { key: "email", label: "Email", type: "email", placeholder: "aarav@example.com" },
      { key: "phone", label: "Phone", placeholder: "9876500011" },
      { key: "company", label: "Company", placeholder: "Northside Retail", full: true },
      {
        key: "sourceCode",
        label: "Source",
        type: "select",
        options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
        initial: "WEBSITE",
      },
      {
        key: "statusCode",
        label: "Status",
        type: "select",
        /* CONVERTED is deliberately absent. It is written by the convert action
           and by nothing else — the API refuses it here too, so offering it
           would be a field that always errors. */
        options: (["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED"] as LeadStatus[]).map((value) => ({
          value,
          label: LEAD_STATUS_LABELS[value],
        })),
        initial: "NEW",
      },
      {
        key: "score",
        label: "Score",
        hint: "0–100",
        type: "number",
        min: "0",
        step: "1",
        help: "How warm this is, in your own judgement. It sorts nothing on its own — it is a note to whoever picks the lead up next.",
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
      {
        key: "message",
        label: "What they said",
        type: "textarea",
        full: true,
        placeholder: "Wants 40 units for a pop-up in September.",
      },
    ],
    [owners],
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: "Lead", primary: true, sub: "company" },
      { key: "email", label: "Email", hideSmall: true },
      { key: "source", label: "Source", hideSmall: true },
      { key: "score", label: "Score", numeric: true, align: "right" },
      { key: "owner", label: "Owner", hideSmall: true },
      { key: "age", label: "Waiting", hideSmall: true },
      { key: "status", label: "Status", status: true },
    ],
    [],
  );

  const open = leads.filter((lead) => lead.status !== "CONVERTED" && lead.status !== "UNQUALIFIED");
  const unowned = leads.filter((lead) => lead.owner === null && lead.status !== "CONVERTED");

  return (
    <AdminPage
      eyebrow="Relationships"
      icon={Sparkles}
      lede="Everyone who has raised a hand and not yet been answered. Qualifying one writes a contact, its company, and the deal that follows from it."
      spec={[
        { label: "Open", value: String(open.length) },
        { label: "Unassigned", value: String(unowned.length) },
        { label: "Converted", value: String(leads.filter((l) => l.status === "CONVERTED").length) },
      ]}
      title={
        <>
          Inbound <em>leads</em>
        </>
      }
    >
      <RecordManager
        columns={columns}
        emptyHint="Leads arrive from the website's contact form, from Instagram, and from whoever walks in. Add one by hand when it comes to you another way."
        error={error}
        fields={fields}
        filterKey="status"
        filterOrder={STATUS_ORDER}
        filterValues={STATUS_ORDER}
        icon={Sparkles}
        loaded={loaded}
        loading={loading}
        onCreate={async (values) => {
          await crm.createLead({
            name: values.name,
            email: values.email,
            phone: values.phone,
            company: values.company,
            source: values.sourceCode,
            status: values.statusCode,
            score: Number(values.score ?? 0) || 0,
            message: values.message,
            owner: values.ownerId,
          });
          await after();
        }}
        onDelete={async (row) => {
          await crm.deleteLead(row.id);
          await after();
        }}
        onUpdate={async (values, previous) => {
          await crm.updateLead(previous.id, {
            name: values.name,
            email: values.email,
            phone: values.phone,
            company: values.company,
            source: values.sourceCode,
            status: values.statusCode,
            score: Number(values.score ?? 0) || 0,
            message: values.message,
            owner: values.ownerId || "none",
          });
          await after();
        }}
        plural="leads"
        rowAction={(row) => {
          /* Only offered on a lead that has not been converted. A verb that
             would 409 is a verb the row should not show. */
          if (row.statusCode === "CONVERTED") return null;

          return {
            icon: UserPlus,
            label: "Qualify and convert",
            tone: "good",
            onSelect: () => {
              const lead = leads.find((candidate) => candidate.id === row.id);
              if (lead) setConverting(lead);
            },
          };
        }}
        rows={rows}
        searchKeys={["id", "name", "email", "phone", "company", "owner", "message"]}
        singular="Lead"
        statusTone={(row) => STATUS_TONES[row.status]}
      />

      {converting && (
        <ConvertLeadDialog
          lead={converting}
          onClose={() => setConverting(null)}
          onDone={async (lead) => {
            setConverting(null);
            await after();
            toast.success(`${lead.name} is now a contact.`, {
              description: lead.convertedDealId
                ? `Deal ${lead.convertedDealId} opened on the pipeline.`
                : "No deal was opened.",
            });
          }}
          owners={owners}
        />
      )}
    </AdminPage>
  );
}
