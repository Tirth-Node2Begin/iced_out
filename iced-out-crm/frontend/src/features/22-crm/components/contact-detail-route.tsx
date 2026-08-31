"use client";

import { Building2, Contact as ContactIcon, ExternalLink, Handshake, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  AdminPage,
  DetailList,
  Empty,
  Panel,
  Section,
  Status,
  type StatusTone,
} from "@/components/shell/admin-ui";
import { RecordTimeline } from "@/features/22-crm/components/record-timeline";
import { useContact, useOwners } from "@/features/22-crm/crm-api";
import { LIFECYCLE_LABELS, SOURCE_LABELS } from "@/features/22-crm/types";

/**
 * One person, and everything the two halves of this database know about them.
 *
 * The commerce column is the point of the screen. The orders listed here come
 * from the storefront's own register — the same rows the shop billed against —
 * matched by the account link or by the frozen contact_email on the order, so a
 * customer whose purchases were all guest checkouts still has a history.
 *
 * The id comes from the QUERY, not the path. Every record route in this app
 * does that, because the frontend is a static export: `/contacts/detail?id=…`
 * is one page for every contact, where `/contacts/[id]` would need one built per
 * id at build time.
 */

const LIFECYCLE_TONES: Record<string, StatusTone> = {
  SUBSCRIBER: "idle",
  LEAD: "info",
  QUALIFIED: "warn",
  CUSTOMER: "good",
  CHURNED: "bad",
};

function ContactDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { detail, loading, loaded, reload } = useContact(id);
  const { owners } = useOwners();

  if (!loaded && loading) {
    return (
      <AdminPage
        back={{ href: "/contacts", label: "Contacts" }}
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
        back={{ href: "/contacts", label: "Contacts" }}
        eyebrow="Relationships"
        title="Not found"
      >
        <Empty
          copy="It may have been removed, or the link may be wrong."
          icon={ContactIcon}
          title="That contact could not be found"
        />
      </AdminPage>
    );
  }

  const { contact, deals, activities, notes, orders } = detail;

  return (
    <AdminPage
      back={{ href: "/contacts", label: "Contacts" }}
      eyebrow="Contact"
      icon={ContactIcon}
      lede={
        [contact.jobTitle, contact.company?.name].filter(Boolean).join(" · ") ||
        "No company on file."
      }
      spec={[
        { label: "Orders", value: String(contact.ordersCount) },
        { label: "Spend", value: contact.ordersTotal },
        { label: "Open deals", value: String(contact.openDeals) },
      ]}
      title={contact.name}
    >
      <div className="crm-detail">
        <Section eyebrow="Record" title="Details">
          <Panel>
            <DetailList
              rows={[
                { label: "Email", value: contact.email || "—" },
                { label: "Phone", value: contact.phone || "—" },
                { label: "Role", value: contact.jobTitle || "—" },
                {
                  label: "Company",
                  value: contact.company ? (
                    <Link className="aui-link" href={`/companies/detail?id=${encodeURIComponent(contact.company.id)}`}>
                      <Building2 aria-hidden size={13} strokeWidth={1.8} /> {contact.company.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Lifecycle",
                  value: (
                    <Status
                      tone={LIFECYCLE_TONES[contact.lifecycle]}
                      value={LIFECYCLE_LABELS[contact.lifecycle]}
                    />
                  ),
                },
                { label: "Source", value: SOURCE_LABELS[contact.source] ?? contact.source },
                { label: "Owner", value: contact.owner?.name ?? "Unassigned" },
                {
                  label: "Where",
                  value: [contact.city, contact.state, contact.country].filter(Boolean).join(", ") || "—",
                },
                {
                  /* Null here is a FACT, not a gap: plenty of people the shop
                     deals with have never opened a storefront account. */
                  label: "Storefront account",
                  value: contact.customerId ? (
                    <Link
                      className="aui-link"
                      href={`/customers/detail?id=${encodeURIComponent(contact.customerId)}`}
                    >
                      <ExternalLink aria-hidden size={13} strokeWidth={1.8} /> {contact.customerId}
                    </Link>
                  ) : (
                    "None"
                  ),
                },
                { label: "Added", value: contact.createdAt ?? "—" },
              ]}
            />
          </Panel>
        </Section>

        <Section
          copy="From the storefront's own register — not a copy, and never out of date."
          eyebrow="Commerce"
          title="Orders"
        >
          <Panel>
            {orders.length === 0 && (
              <Empty
                copy="Nothing has been bought under this email or account."
                icon={ShoppingBag}
                inline
                title="No orders"
              />
            )}

            {orders.length > 0 && (
              <ul className="crm-linked">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/orders/detail?id=${encodeURIComponent(order.id)}`}>
                      <span>
                        <strong>{order.number}</strong>
                        <small>{order.placedAt}</small>
                      </span>
                      <b>{order.total}</b>
                      <Status value={order.status} />
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
                copy="Open one from the pipeline when there is a conversation worth money."
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
        about={{ type: "contact", id: contact.id, label: contact.name }}
        activities={activities}
        notes={notes}
        onChange={reload}
        owners={owners}
      />
    </AdminPage>
  );
}

/* `useSearchParams` suspends, and this page is statically exported — without the
   boundary the whole route opts out of prerendering. */
export function ContactDetailRoute() {
  return (
    <Suspense fallback={<p className="aui-muted">Reading the record…</p>}>
      <ContactDetail />
    </Suspense>
  );
}
