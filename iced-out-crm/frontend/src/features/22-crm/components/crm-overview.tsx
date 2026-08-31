"use client";

import {
  Building2,
  Contact as ContactIcon,
  Handshake,
  ListChecks,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import { Empty, Panel, Section } from "@/components/shell/admin-ui";
import { useCrmSummary } from "@/features/22-crm/crm-api";
import { ACTIVITY_LABELS } from "@/features/22-crm/types";

/**
 * The relationship half of the landing screen.
 *
 * The commerce dashboard above it answers "what does the shop owe its customers
 * today". This answers "what does the team owe its conversations" — and the two
 * are deliberately different questions with different shapes: trading is a
 * PERIOD and moves with the date filter, a pipeline is a POSITION and does not.
 * Putting the forecast under the date picker would invite "revenue, last 30
 * days" and "weighted pipeline, last 30 days" to be read as the same kind of
 * number, and they are not.
 */
export function CrmOverview() {
  const { data, loading, loaded } = useCrmSummary();

  const pipeline: Stat[] = [
    {
      label: "Open pipeline",
      value: data?.pipeline.openValue ?? "—",
      note: `${data?.pipeline.openCount ?? 0} deals still in play`,
      icon: Handshake,
      tone: "sky",
      href: "/deals",
    },
    {
      label: "Weighted",
      value: data?.pipeline.weightedValue ?? "—",
      /* Not a forecast the shop should bank on, and the note says so — each
         deal counted at its OWN odds, which is a judgement, not a measurement. */
      note: "Each deal at the odds you gave it",
      icon: TrendingUp,
      tone: "violet",
      href: "/deals",
    },
    {
      label: "Won",
      value: data?.pipeline.wonValue ?? "—",
      note:
        data?.pipeline.winRate === null || data?.pipeline.winRate === undefined
          ? "Nothing has settled yet"
          : `${data.pipeline.winRate}% of settled deals`,
      icon: Handshake,
      tone: "mint",
      href: "/deals",
    },
    {
      label: "Open leads",
      value: String(data?.leads.open ?? 0),
      note: `${data?.leads.new ?? 0} not yet contacted`,
      icon: Sparkles,
      tone: data?.leads.new ? "amber" : "ink",
      href: "/leads",
    },
    {
      label: "Contacts",
      value: String(
        Object.values(data?.contacts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0),
      ),
      note: `${data?.contacts.CUSTOMER ?? 0} have bought something`,
      icon: ContactIcon,
      tone: "ink",
      href: "/contacts",
    },
    {
      label: "Overdue tasks",
      value: String(data?.tasks.overdue ?? 0),
      note:
        (data?.mine.overdue ?? 0) > 0
          ? `${data?.mine.overdue} of them are yours`
          : "None of them are yours",
      icon: ListChecks,
      tone: data?.tasks.overdue ? "rose" : "mint",
      href: "/tasks",
    },
  ];

  return (
    <>
      <Section
        copy="Where every conversation stands, and what is late. These are positions, not a period — they do not move with the date filter above."
        eyebrow="Relationships"
        title="The pipeline"
      >
        <StatGrid stats={pipeline} />
      </Section>

      <Section
        copy="Everything past its due date, whoever it belongs to."
        eyebrow="Waiting"
        title="Overdue"
      >
        <Panel>
          {loading && !loaded && <p className="aui-muted">Reading the queue…</p>}

          {loaded && (data?.today.length ?? 0) === 0 && (
            <Empty
              copy="Nothing is past its due date. Open the task list to see what is coming."
              icon={ListChecks}
              inline
              title="Nothing is late"
            />
          )}

          {(data?.today.length ?? 0) > 0 && (
            <ul className="crm-tasks crm-tasks--tight">
              {data?.today.map((task) => (
                <li className="crm-task" data-overdue="true" key={task.id}>
                  <span className="crm-task__glyph">
                    <ListChecks aria-hidden size={16} strokeWidth={1.7} />
                  </span>
                  <Link className="crm-task__body" href="/tasks">
                    <strong>{task.subject}</strong>
                    <small>
                      {ACTIVITY_LABELS[task.type]}
                      {task.owner ? ` · ${task.owner.name}` : " · Unassigned"}
                      {task.dueAt ? ` · was due ${task.dueAt}` : ""}
                    </small>
                  </Link>
                  <span className="crm-task__flag">Overdue</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      {(data?.recentLeads.length ?? 0) > 0 && (
        <Section
          copy="The newest hands raised. Qualifying one writes a contact, its company and the deal that follows."
          eyebrow="Inbound"
          title="Latest leads"
        >
          <Panel>
            <ul className="crm-tasks crm-tasks--tight">
              {data?.recentLeads.map((lead) => (
                <li className="crm-task" key={lead.id}>
                  <span className="crm-task__glyph">
                    {lead.company ? (
                      <Building2 aria-hidden size={16} strokeWidth={1.7} />
                    ) : (
                      <Sparkles aria-hidden size={16} strokeWidth={1.7} />
                    )}
                  </span>
                  <Link className="crm-task__body" href="/leads">
                    <strong>{lead.name}</strong>
                    <small>
                      {lead.company || "No company"}
                      {lead.owner ? ` · ${lead.owner.name}` : " · Unassigned"}
                      {lead.age ? ` · waiting ${lead.age}` : ""}
                    </small>
                  </Link>
                  <span className="crm-task__flag" data-tone="quiet">
                    {lead.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}
    </>
  );
}
