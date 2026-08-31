"use client";

import { ListChecks, Trash2, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import { crm, useContacts, useLeads } from "@/features/22-crm/crm-api";
import { ACTIVITY_LABELS, type Activity, type ActivityType, type StaffOwner } from "@/features/22-crm/types";

/**
 * One task, created or edited.
 *
 * WHAT IT IS ABOUT is asked once and never again. An activity's subject is a
 * polymorphic pointer, and re-pointing one at a different record would silently
 * move a piece of history off the timeline it was written on — so on the edit
 * form the two fields are simply absent, and the server ignores them there too.
 *
 * The `about` picker only offers leads and contacts. A task on a deal or a
 * company is created from that record's own screen, where the record is already
 * chosen and the picker would be a list of one.
 */
export function TaskDialog({
  task,
  owners,
  onClose,
  onDone,
  /** Pre-chosen when opened from a record's own screen. */
  about,
}: {
  task: Activity | null;
  owners: StaffOwner[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
  about?: { type: "lead" | "contact" | "company" | "deal" | "order"; id: string; label: string };
}) {
  const editing = task !== null;
  /* Only loaded when the picker is actually shown. Creating a task from a deal
     screen must not pull the whole contact register in behind it. */
  const needsPicker = !editing && about === undefined;
  const { contacts } = useContacts({}, needsPicker);
  const { leads } = useLeads({}, needsPicker);

  const [kind, setKind] = useState<"contact" | "lead">("contact");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);

    const shared = {
      subject: String(form.get("subject") ?? ""),
      type: String(form.get("type") ?? "TASK"),
      body: String(form.get("body") ?? ""),
      dueAt: String(form.get("dueAt") ?? ""),
      priority: String(form.get("priority") ?? "NORMAL"),
      owner: String(form.get("owner") ?? "none"),
    };

    try {
      if (editing) {
        await crm.updateActivity(task.id, shared);
      } else {
        await crm.createActivity({
          ...shared,
          aboutType: about?.type ?? kind,
          aboutId: about?.id ?? String(form.get("aboutId") ?? ""),
        });
      }

      await onDone();
      toast.success(editing ? "Task updated." : "Task added.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The task was not saved.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task || busy) return;
    setBusy(true);

    try {
      await crm.deleteActivity(task.id);
      await onDone();
      toast.success("Task removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be removed.";
      setFailure(message);
      toast.error("The task was not removed.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  /* `datetime-local` wants "2026-08-30T14:30" and the wire carries
     "30 Aug 2026 · 14:30", so an edit form cannot round-trip the value. Left
     blank rather than wrong: the current due date is printed under the field. */
  const dueHint = task?.dueAt ? `Currently due ${task.dueAt}. Leave blank to keep it.` : undefined;

  return (
    <Modal
      description={
        editing
          ? "What it is about cannot change — that would move this off the timeline it was written on."
          : about
            ? `This will be logged against ${about.label}.`
            : "Every task hangs off a record, so it is never a note floating on its own."
      }
      footer={
        <>
          {editing && (
            <Btn className="crm-dialog__delete" disabled={busy} onClick={remove} variant="danger">
              <Trash2 aria-hidden size={15} strokeWidth={1.7} /> Remove
            </Btn>
          )}
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy} form="task-form" type="submit" variant="solid">
            {busy ? "Saving…" : editing ? "Save task" : "Add task"}
          </Btn>
        </>
      }
      icon={ListChecks}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      title={editing ? task.subject : "New task"}
    >
      <form className="aui-form" id="task-form" onSubmit={submit}>
        <Field full label="What needs doing">
          <input
            defaultValue={task?.subject ?? ""}
            name="subject"
            placeholder="Send the pop-up quote"
            required
          />
        </Field>

        <Field label="Kind">
          <Select
            defaultValue={task?.type ?? "TASK"}
            name="type"
            options={(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((value) => ({
              value,
              label: ACTIVITY_LABELS[value],
            }))}
          />
        </Field>

        <Field label="Priority">
          <Select
            defaultValue={task?.priority ?? "NORMAL"}
            name="priority"
            options={[
              { value: "LOW", label: "Low" },
              { value: "NORMAL", label: "Normal" },
              { value: "HIGH", label: "High" },
            ]}
          />
        </Field>

        {needsPicker && (
          <>
            <Field label="About a">
              <Select
                name="aboutType"
                onValueChange={(next) => setKind(next as "contact" | "lead")}
                options={[
                  { value: "contact", label: "Contact" },
                  { value: "lead", label: "Lead" },
                ]}
                value={kind}
              />
            </Field>

            <Field full label={kind === "lead" ? "Which lead" : "Which contact"}>
              <Select
                key={kind}
                name="aboutId"
                options={
                  kind === "lead"
                    ? leads.map((lead) => ({ value: lead.id, label: lead.name }))
                    : contacts.map((contact) => ({
                        value: contact.id,
                        label: contact.email ? `${contact.name} — ${contact.email}` : contact.name,
                      }))
                }
              />
            </Field>
          </>
        )}

        <Field help={dueHint} label="Due">
          <input name="dueAt" type="datetime-local" />
        </Field>

        <Field label="Owner">
          <Select
            defaultValue={task?.owner?.id ?? "me"}
            name="owner"
            options={[
              { value: "me", label: "Me" },
              { value: "none", label: "Unassigned" },
              ...owners.map((staff) => ({ value: staff.id, label: staff.name })),
            ]}
          />
        </Field>

        <Field full label="Notes">
          <textarea defaultValue={task?.body ?? ""} name="body" rows={3} />
        </Field>

        {failure && (
          <Note icon={TriangleAlert} title="That did not save" tone="bad">
            {failure}
          </Note>
        )}
      </form>
    </Modal>
  );
}
