"use client";

import {
  Check,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Pin,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Btn, Empty, IconBtn, Panel, Section, Tabs } from "@/components/shell/admin-ui";
import { TaskDialog } from "@/features/22-crm/components/task-dialog";
import { crm } from "@/features/22-crm/crm-api";
import {
  ACTIVITY_LABELS,
  type Activity,
  type ActivityType,
  type Note,
  type StaffOwner,
  type SubjectType,
} from "@/features/22-crm/types";

/**
 * The bottom half of every record screen: what has happened, what is waiting,
 * and the sentence no column has a place for.
 *
 * One component for contacts, companies and deals, because the three ask the
 * same question of their history and answering it three ways would mean three
 * places to fix when the answer changes.
 *
 * Notes and tasks are separate tabs rather than one merged stream. They look
 * alike and they are not: a task is work with a state, a note is a fact with an
 * author. Merging them produces a list where half the rows have a checkbox that
 * means nothing.
 */

const TYPE_ICONS: Record<ActivityType, typeof Phone> = {
  TASK: ListChecks,
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
};

export function RecordTimeline({
  about,
  activities,
  notes,
  owners,
  onChange,
}: {
  about: { type: SubjectType; id: string; label: string };
  activities: Activity[];
  notes: Note[];
  owners: StaffOwner[];
  /* Deliberately `unknown` rather than `void`: the callers hand this their
     store's `reload`, which resolves WITH the refreshed record. Narrowing the
     type to void would make every call site wrap it in a lambda that throws the
     value away — five characters of noise for nothing this component wants. */
  onChange: () => unknown;
}) {
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);
  const [posting, setPosting] = useState(false);

  const open = activities.filter((task) => !task.done);

  const toggle = useCallback(
    async (task: Activity) => {
      try {
        if (task.done) await crm.reopenActivity(task.id);
        else await crm.completeActivity(task.id);
        await onChange();
      } catch (error) {
        toast.error("That did not save.", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [onChange],
  );

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting) return;

    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (body === "") return;

    setPosting(true);

    try {
      await crm.createNote(about.type, about.id, body);
      /* Reset before the reload, so the box is empty the instant the note
         appears rather than a frame later. */
      form.reset();
      await onChange();
    } catch (error) {
      toast.error("The note was not saved.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPosting(false);
    }
  }

  async function removeNote(id: string) {
    try {
      await crm.deleteNote(id);
      await onChange();
    } catch (error) {
      toast.error("The note was not removed.", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function togglePin(note: Note) {
    try {
      await crm.updateNote(note.id, { pinned: !note.pinned });
      await onChange();
    } catch (error) {
      toast.error("That did not save.", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Section
      actions={
        tab === "tasks" ? (
          <Btn onClick={() => setCreating(true)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> Task
          </Btn>
        ) : undefined
      }
      copy="Everything logged against this record, newest first."
      eyebrow="History"
      title="Activity"
    >
      <Tabs
        inline
        label="Record history"
        onChange={(next) => setTab(next as "tasks" | "notes")}
        options={[
          { value: "tasks", label: "Tasks", count: open.length },
          { value: "notes", label: "Notes", count: notes.length },
        ]}
        value={tab}
      />

      <Panel>
        {tab === "tasks" && (
          <>
            {activities.length === 0 && (
              <Empty
                action={
                  <Btn onClick={() => setCreating(true)} variant="solid">
                    <Plus aria-hidden size={15} strokeWidth={2} /> Add a task
                  </Btn>
                }
                copy="Log the call you just had, or set a reminder for the one you owe."
                icon={ListChecks}
                inline
                title="Nothing logged yet"
              />
            )}

            {activities.length > 0 && (
              <ul className="crm-tasks">
                {activities.map((task) => {
                  const Icon = TYPE_ICONS[task.type] ?? ListChecks;

                  return (
                    <li
                      className="crm-task"
                      data-done={task.done ? "true" : "false"}
                      data-overdue={task.overdue ? "true" : "false"}
                      key={task.id}
                    >
                      <span className="crm-task__glyph">
                        <Icon aria-hidden size={16} strokeWidth={1.7} />
                      </span>
                      <button className="crm-task__body" onClick={() => setEditing(task)} type="button">
                        <strong>{task.subject}</strong>
                        <small>
                          {ACTIVITY_LABELS[task.type]}
                          {task.owner ? ` · ${task.owner.name}` : " · Unassigned"}
                          {task.done
                            ? task.outcome
                              ? ` · ${task.outcome}`
                              : " · done"
                            : task.dueAt
                              ? ` · due ${task.dueAt}`
                              : " · no date"}
                        </small>
                      </button>
                      {task.overdue && <span className="crm-task__flag">Overdue</span>}
                      <IconBtn
                        good={!task.done}
                        icon={task.done ? RotateCcw : Check}
                        label={task.done ? "Reopen this task" : "Mark it done"}
                        onClick={() => toggle(task)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {tab === "notes" && (
          <>
            <form className="crm-note-form" onSubmit={addNote}>
              <textarea
                name="body"
                placeholder={`Something worth remembering about ${about.label}…`}
                rows={2}
              />
              <Btn disabled={posting} size="sm" type="submit" variant="solid">
                {posting ? "Saving…" : "Add note"}
              </Btn>
            </form>

            {notes.length === 0 && (
              <Empty
                copy="A pinned note stays at the top of this list — the one fact about this record that must survive scrolling."
                icon={StickyNote}
                inline
                title="No notes yet"
              />
            )}

            {notes.length > 0 && (
              <ul className="crm-notes">
                {notes.map((note) => (
                  <li className="crm-note" data-pinned={note.pinned ? "true" : "false"} key={note.id}>
                    <p>{note.body}</p>
                    <footer>
                      <span>
                        {note.author || "Someone"}
                        {note.createdAt ? ` · ${note.createdAt}` : ""}
                      </span>
                      <IconBtn
                        icon={Pin}
                        label={note.pinned ? "Unpin this note" : "Pin it to the top"}
                        onClick={() => togglePin(note)}
                      />
                      <IconBtn
                        danger
                        icon={Trash2}
                        label="Remove this note"
                        onClick={() => removeNote(note.id)}
                      />
                    </footer>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      {(creating || editing) && (
        <TaskDialog
          about={creating ? about : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await onChange();
          }}
          owners={owners}
          task={editing}
        />
      )}
    </Section>
  );
}
