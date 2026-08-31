"use client";

import { Handshake, Trash2, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import { crm, useCompanyOptions, useContacts } from "@/features/22-crm/crm-api";
import { SOURCE_LABELS, type Deal, type Stage, type StaffOwner } from "@/features/22-crm/types";

/**
 * One form for creating a deal and for editing one.
 *
 * The two differ by exactly three things — the title, the verb on the button,
 * and whether a stage can be chosen — so they are one component rather than two
 * near-copies that drift.
 *
 * The stage IS offered on the edit form, and that is worth stating: dragging is
 * the fast path, but a deal you are already looking at should not have to be
 * closed and dragged to be moved. Both routes go through the same endpoint, so
 * both settle a won deal the same way.
 */
export function DealDialog({
  deal,
  stages,
  owners,
  pipeline,
  onClose,
  onDone,
}: {
  /** Null when creating. */
  deal: Deal | null;
  stages: Stage[];
  owners: StaffOwner[];
  pipeline: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { companies } = useCompanyOptions();
  const { contacts } = useContacts({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const editing = deal !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);

    const body = {
      title: String(form.get("title") ?? ""),
      contact: String(form.get("contact") ?? "none"),
      company: String(form.get("company") ?? "none"),
      amount: Number(form.get("amount") ?? 0) || 0,
      source: String(form.get("source") ?? "OTHER"),
      probability: Number(form.get("probability") ?? 0) || 0,
      expectedCloseOn: String(form.get("expectedCloseOn") ?? ""),
      owner: String(form.get("owner") ?? "none"),
    };

    try {
      if (editing) {
        await crm.updateDeal(deal.id, { ...body, lostReason: String(form.get("lostReason") ?? "") });

        /* The stage is moved through the move endpoint even from here, so the
           settle rules live in exactly one place. No neighbours are sent: from
           a form there is no drop position, and the server puts it at the end
           of the column. */
        const stage = String(form.get("stage") ?? "");
        if (stage && stage !== deal.stage.slug) await crm.moveDeal(deal.id, stage);
      } else {
        await crm.createDeal({ ...body, pipeline, stage: String(form.get("stage") ?? "") });
      }

      await onDone();
      toast.success(editing ? "Deal updated." : "Deal opened.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error(editing ? "The deal was not updated." : "The deal was not opened.", {
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deal || busy) return;
    setBusy(true);

    try {
      await crm.deleteDeal(deal.id);
      await onDone();
      toast.success("Deal removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be removed.";
      setFailure(message);
      toast.error("The deal was not removed.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description={
        editing
          ? "Everything here is a judgement you can revise. Moving the stage settles the deal the same way dragging it does."
          : "It opens in whichever stage you pick, on the pipeline you are looking at."
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
          <Btn disabled={busy} form="deal-form" type="submit" variant="solid">
            {busy ? "Saving…" : editing ? "Save deal" : "Open deal"}
          </Btn>
        </>
      }
      icon={Handshake}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      size="wide"
      title={editing ? deal.title : "New deal"}
    >
      <form className="aui-form" id="deal-form" onSubmit={submit}>
        <Field full label="Title">
          <input
            defaultValue={deal?.title ?? ""}
            name="title"
            placeholder="Northside pop-up order"
            required
          />
        </Field>

        <Field label="Stage">
          <Select
            defaultValue={deal?.stage.slug ?? stages[0]?.slug ?? ""}
            name="stage"
            options={stages.map((stage) => ({ value: stage.slug, label: stage.name }))}
          />
        </Field>

        <Field help="Blank uses the stage's own odds." hint="%" label="Likelihood">
          <input
            defaultValue={deal ? String(deal.probability) : ""}
            max="100"
            min="0"
            name="probability"
            step="5"
            type="number"
          />
        </Field>

        <Field hint="₹" label="Value">
          <input
            defaultValue={deal ? String(Math.round(deal.amountRaw)) : ""}
            min="0"
            name="amount"
            placeholder="184000"
            step="1"
            type="number"
          />
        </Field>

        <Field label="Expected close">
          <input defaultValue={deal?.expectedCloseOn ?? ""} name="expectedCloseOn" type="date" />
        </Field>

        <Field full label="Contact">
          <Select
            defaultValue={deal?.contact?.id ?? "none"}
            name="contact"
            options={[
              { value: "none", label: "No contact" },
              ...contacts.map((contact) => ({
                value: contact.id,
                /* The email disambiguates two people who share a name — and two
                   people sharing a name is the normal case at scale, not an
                   edge one. */
                label: contact.email ? `${contact.name} — ${contact.email}` : contact.name,
              })),
            ]}
          />
        </Field>

        <Field full label="Company">
          <Select
            defaultValue={deal?.company?.id ?? "none"}
            name="company"
            options={[
              { value: "none", label: "No company" },
              ...companies.map((company) => ({ value: company.id, label: company.name })),
            ]}
          />
        </Field>

        <Field label="Source">
          <Select
            defaultValue={deal?.source ?? "OTHER"}
            name="source"
            options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>

        <Field label="Owner">
          <Select
            defaultValue={deal?.owner?.id ?? "none"}
            name="owner"
            options={[
              { value: "none", label: "Unassigned" },
              ...owners.map((staff) => ({ value: staff.id, label: staff.name })),
            ]}
          />
        </Field>

        {editing && (
          <Field
            full
            help="Only read when the deal is lost — but worth writing while you still remember, not when you are closing it."
            label="If it is lost, why"
          >
            <input defaultValue={deal.lostReason} name="lostReason" placeholder="Went with another supplier" />
          </Field>
        )}

        {failure && (
          <Note icon={TriangleAlert} title="That did not save" tone="bad">
            {failure}
          </Note>
        )}
      </form>
    </Modal>
  );
}
