"use client";

import {
  Check,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Btn, Empty, IconBtn, Note, Panel, Select, Tabs } from "@/components/shell/admin-ui";
import { Toolbar } from "@/components/shell/toolbar";
import { TaskDialog } from "@/features/22-crm/components/task-dialog";
import { crm, useActivities, useOwners, useRefreshCounts } from "@/features/22-crm/crm-api";
import { ACTIVITY_LABELS, type Activity, type ActivityType } from "@/features/22-crm/types";

/**
 * Tasks — what is waiting on you, and what happened.
 *
 * One list, four tabs, and the tabs are the only place this screen filters
 * SERVER-SIDE. That is deliberate: "overdue" and "today" are questions about the
 * clock, and the clock the answer must be measured against is the server's.
 * Computing them in the browser would make the list disagree with the badge in
 * the rail for anyone whose machine is a few minutes out — and a task list that
 * disagrees with its own badge is one nobody trusts.
 *
 * The counts beside the tabs answer for whoever the list is filtered to, so an
 * operator reading their own queue never sees the team's overdue count above it.
 */

const SCOPES = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "open", label: "All open" },
  { value: "done", label: "Done" },
];

const TYPE_ICONS: Record<ActivityType, typeof Phone> = {
  TASK: ListChecks,
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
};

function TaskRow({
  task,
  onToggle,
  onOpen,
}: {
  task: Activity;
  onToggle: (task: Activity) => void;
  onOpen: (task: Activity) => void;
}) {
  const Icon = TYPE_ICONS[task.type] ?? ListChecks;

  return (
    <li className="crm-task" data-done={task.done ? "true" : "false"} data-overdue={task.overdue ? "true" : "false"}>
      <span className="crm-task__glyph">
        <Icon aria-hidden size={16} strokeWidth={1.7} />
      </span>

      <button className="crm-task__body" onClick={() => onOpen(task)} type="button">
        <strong>{task.subject}</strong>
        <small>
          {ACTIVITY_LABELS[task.type]}
          {task.owner ? ` · ${task.owner.name}` : " · Unassigned"}
          {task.dueAt ? ` · due ${task.dueAt}` : " · no date"}
          {task.done && task.outcome ? ` · ${task.outcome}` : ""}
        </small>
      </button>

      {task.overdue && <span className="crm-task__flag">Overdue</span>}
      {task.priority === "HIGH" && !task.done && <span className="crm-task__flag" data-tone="high">High</span>}

      <IconBtn
        good={!task.done}
        icon={task.done ? RotateCcw : Check}
        label={task.done ? "Reopen this task" : "Mark it done"}
        onClick={() => onToggle(task)}
      />
    </li>
  );
}

export function TasksWorkspace() {
  const [scope, setScope] = useState<string>("open");
  const [owner, setOwner] = useState("all");
  const { activities, counts, loading, error, loaded, reload } = useActivities({ scope, owner });
  const { owners } = useOwners();
  const refreshCounts = useRefreshCounts();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);

  const after = useCallback(async () => {
    await reload();
    /* The rail badge counts overdue tasks for whoever is signed in. */
    void refreshCounts();
  }, [refreshCounts, reload]);

  const toggle = useCallback(
    async (task: Activity) => {
      try {
        if (task.done) await crm.reopenActivity(task.id);
        else await crm.completeActivity(task.id);
        await after();
      } catch (failure) {
        toast.error("That did not save.", {
          description: failure instanceof Error ? failure.message : undefined,
        });
      }
    },
    [after],
  );

  return (
    <AdminPage
      eyebrow="Relationships"
      icon={ListChecks}
      lede="Calls to make, quotes to send, meetings that happened. Every one hangs off a record, so a task is never a note floating on its own."
      spec={[
        { label: "Overdue", value: String(counts.overdue) },
        { label: "Due today", value: String(counts.today) },
        { label: "Open", value: String(counts.open) },
      ]}
      title={
        <>
          What is <em>waiting</em>
        </>
      }
    >
      {/* The same band every register uses: queues on the left, the owner
          filter and the verb on the right. The filter used to live up in the
          page header, which put it above the hero and a long way from the list
          it narrows. */}
      <Toolbar
        actions={
          <Btn onClick={() => setCreating(true)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> New task
          </Btn>
        }
        filters={
          <Select
            aria-label="Filter by owner"
            name="owner"
            onValueChange={setOwner}
            options={[
              { value: "all", label: "Everyone" },
              { value: "me", label: "Mine" },
              { value: "unassigned", label: "Unassigned" },
              ...owners.map((staff) => ({ value: staff.id, label: staff.name })),
            ]}
            value={owner}
          />
        }
        lead={
          <Tabs
            label="Task queues"
            onChange={setScope}
            options={SCOPES.map((entry) => ({
              ...entry,
              /* Only the two that are a call to action carry a number.
                 "Upcoming" counting fifty is not news, and a rail of five
                 numbers is a rail nobody reads. */
              count:
                entry.value === "overdue"
                  ? counts.overdue
                  : entry.value === "today"
                    ? counts.today
                    : undefined,
            }))}
            value={scope}
          />
        }
      />

      {error && (
        <Note icon={TriangleAlert} title="That list could not be read" tone="bad">
          {error}
        </Note>
      )}

      <Panel>
        {loading && !loaded && <p className="aui-muted">Reading the queue…</p>}

        {loaded && activities.length === 0 && (
          <Empty
            copy={
              scope === "overdue"
                ? "Nothing is late. That is the whole point of this tab being empty."
                : "Add one, or open a lead, contact or deal and log the call you just had."
            }
            icon={ListChecks}
            inline
            title={scope === "done" ? "Nothing finished yet" : "Nothing waiting"}
          />
        )}

        {activities.length > 0 && (
          <ul className="crm-tasks">
            {activities.map((task) => (
              <TaskRow key={task.id} onOpen={setEditing} onToggle={toggle} task={task} />
            ))}
          </ul>
        )}
      </Panel>

      {(creating || editing) && (
        <TaskDialog
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await after();
          }}
          owners={owners}
          task={editing}
        />
      )}
    </AdminPage>
  );
}
