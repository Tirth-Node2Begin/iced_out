"use client";

import { Building2, Contact as ContactIcon, Handshake } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AdminPage, DetailList, Empty, Panel, Section, Status } from "@/components/shell/admin-ui";
import { RecordTimeline } from "@/features/22-crm/components/record-timeline";
import { useCompany, useOwners } from "@/features/22-crm/crm-api";
import { LIFECYCLE_LABELS } from "@/features/22-crm/types";

/**
 * One account: who works there, what is open with them, and what they have
 * bought overall.
 *
 * Same query-string id as every other record route — see the note on the
 * contact screen for why the path cannot carry it.
 */
function CompanyDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { detail, loading, loaded, reload } = useCompany(id);
  const { owners } = useOwners();

  if (!loaded && loading) {
    return (
      <AdminPage
        back={{ href: "/companies", label: "Companies" }}
        eyebrow="Relationships"
        title="Loading…"
      >
        <p className="aui-muted">Reading the record…</p>
      </AdminPage>
    );
  }

  if (!detail) {
    return (
      <AdminPage
        back={{ href: "/companies", label: "Companies" }}
        eyebrow="Relationships"
        title="Not found"
      >
        <Empty
          copy="It may have been archived and removed, or the link may be wrong."
          icon={Building2}
          title="That company could not be found"
        />
      </AdminPage>
    );
  }

  const { company, contacts, deals, activities, notes } = detail;

  return (
    <AdminPage
      back={{ href: "/companies", label: "Companies" }}
      eyebrow="Company"
      icon={Building2}
      lede={[company.industry, company.city].filter(Boolean).join(" · ") || "No industry on file."}
      spec={[
        { label: "People", value: String(company.contactsCount) },
        { label: "Open deals", value: String(company.openDeals) },
        { label: "Won", value: company.wonValue },
      ]}
      title={company.name}
    >
      <div className="crm-detail">
        <Section eyebrow="Record" title="Details">
          <Panel>
            <DetailList
              rows={[
                { label: "Domain", value: company.domain || "—" },
                {
                  label: "Website",
                  value: company.website ? (
                    /* `noreferrer` with `noopener`: this is an address an
                       operator typed, and the CRM should not announce itself to
                       it as the referrer. */
                    <a className="aui-link" href={company.website} rel="noopener noreferrer" target="_blank">
                      {company.website}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { label: "Email", value: company.email || "—" },
                { label: "Phone", value: company.phone || "—" },
                { label: "Industry", value: company.industry || "—" },
                { label: "Size", value: company.sizeBand ? `${company.sizeBand} people` : "—" },
                {
                  label: "Where",
                  value: [company.city, company.state, company.country].filter(Boolean).join(", ") || "—",
                },
                { label: "Owner", value: company.owner?.name ?? "Unassigned" },
                {
                  label: "Status",
                  value: (
                    <Status
                      tone={company.status === "ACTIVE" ? "good" : "idle"}
                      value={company.status === "ACTIVE" ? "Active" : "Archived"}
                    />
                  ),
                },
                { label: "Added", value: company.createdAt ?? "—" },
              ]}
            />
          </Panel>
        </Section>

        <Section eyebrow="Who" title="People">
          <Panel>
            {contacts.length === 0 && (
              <Empty
                copy="Attach a contact to this company from the contact's own record."
                icon={ContactIcon}
                inline
                title="Nobody here yet"
              />
            )}

            {contacts.length > 0 && (
              <ul className="crm-linked">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <Link href={`/contacts/detail?id=${encodeURIComponent(contact.id)}`}>
                      <span>
                        <strong>{contact.name}</strong>
                        <small>{contact.jobTitle || contact.email || "—"}</small>
                      </span>
                      <b>{contact.ordersTotal}</b>
                      <Status value={LIFECYCLE_LABELS[contact.lifecycle]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>

        <Section eyebrow="Pipeline" title="Deals">
          <Panel>
            {deals.length === 0 && (
              <Empty
                copy="Nothing open with this account right now."
                icon={Handshake}
                inline
                title="No deals"
              />
            )}

            {deals.length > 0 && (
              <ul className="crm-linked">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link href="/deals">
                      <span>
                        <strong>{deal.title}</strong>
                        <small>{deal.stage.name}</small>
                      </span>
                      <b>{deal.amount}</b>
                      <Status
                        tone={deal.status === "WON" ? "good" : deal.status === "LOST" ? "bad" : "info"}
                        value={deal.status === "OPEN" ? "Open" : deal.status === "WON" ? "Won" : "Lost"}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>
      </div>

      <RecordTimeline
        about={{ type: "company", id: company.id, label: company.name }}
        activities={activities}
        notes={notes}
        onChange={reload}
        owners={owners}
      />
    </AdminPage>
  );
}

export function CompanyDetailRoute() {
  return (
    <Suspense fallback={<p className="aui-muted">Reading the record…</p>}>
      <CompanyDetail />
    </Suspense>
  );
}
