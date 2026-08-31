"use client";

import { TriangleAlert, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import { crm } from "@/features/22-crm/crm-api";
import type { Lead, StaffOwner } from "@/features/22-crm/types";

/**
 * Qualifying a lead.
 *
 * One action, three records: a contact always, its company when the lead named
 * one, and a deal when the operator asks for one. The server does all three in
 * a transaction — this form only decides what to ask for.
 *
 * The defaults are the lead's own answers, because the common case is that the
 * lead is right and the operator is confirming rather than typing. The deal
 * amount is the one field that starts blank: guessing what a conversation is
 * worth is exactly the judgement being asked for, and a pre-filled zero would
 * be recorded as one.
 */
export function ConvertLeadDialog({
  lead,
  owners,
  onClose,
  onDone,
}: {
  lead: Lead;
  owners: StaffOwner[];
  onClose: () => void;
  onDone: (lead: Lead) => void | Promise<void>;
}) {
  const [createDeal, setCreateDeal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);

    try {
      const converted = await crm.convertLead(lead.id, {
        company: String(form.get("company") ?? ""),
        createDeal,
        dealTitle: String(form.get("dealTitle") ?? ""),
        dealAmount: Number(form.get("dealAmount") ?? 0) || 0,
        expectedCloseOn: String(form.get("expectedCloseOn") ?? ""),
        owner: String(form.get("owner") ?? ""),
      });
      await onDone(converted);
    } catch (error) {
      /* The API client's normaliser has already turned this into a sentence
         written to be read, so it is shown rather than reworded. The dialog
         stays open: the operator's typing is still in it. */
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The lead was not converted.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description="A contact is written either way. The company and the deal are optional, and everything here can be edited afterwards."
      icon={UserPlus}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy} form="convert-lead" type="submit" variant="solid">
            {busy ? "Converting…" : "Convert lead"}
          </Btn>
        </>
      }
      open
      title={`Convert ${lead.name}`}
      tone="mint"
    >
      <form className="aui-form" id="convert-lead" onSubmit={submit}>
        <Field
          full
          help="Left blank, no company record is written. An existing one with this name is reused rather than duplicated."
          label="Company"
        >
          <input defaultValue={lead.company} name="company" placeholder="Northside Retail" />
        </Field>

        <Field label="Owner">
          <Select
            defaultValue={lead.owner?.id ?? "none"}
            name="owner"
            options={[
              { value: "none", label: "Unassigned" },
              ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
            ]}
          />
        </Field>

        <Field full group label="Open a deal">
          <label className="aui-check">
            <input
              checked={createDeal}
              name="createDeal"
              onChange={(event) => setCreateDeal(event.target.checked)}
              type="checkbox"
              value="true"
            />
            <span aria-hidden className="aui-check__box" />
            <span className="aui-check__copy">
              <strong>Put this on the pipeline</strong>
              <small>Opens a deal in the first stage of the default pipeline.</small>
            </span>
          </label>
        </Field>

        {createDeal && (
          <>
            <Field full label="Deal title">
              <input
                defaultValue={lead.name}
                name="dealTitle"
                placeholder="Northside pop-up order"
                required
              />
            </Field>

            <Field
              help="What you think it is worth today. It is a forecast, not a quote — change it as the conversation moves."
              hint="₹"
              label="Value"
            >
              <input min="0" name="dealAmount" placeholder="184000" step="1" type="number" />
            </Field>

            <Field label="Expected close">
              <input name="expectedCloseOn" type="date" />
            </Field>
          </>
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
