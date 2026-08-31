"use client";

import { Scale, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note, Select, Tabs } from "@/components/shell/admin-ui";
import { materials as api } from "@/features/24-materials/materials-api";
import { UNIT_LABELS, withUnit, type Material } from "@/features/24-materials/types";

/**
 * The two ways a count changes without a purchase or a run behind it.
 *
 * They are separate tabs rather than one form with a dropdown, because they are
 * different claims about reality:
 *
 *   CORRECT   the count was wrong. Nothing physically moved — a stocktake found
 *             more or less than the ledger said, and the ledger is being told.
 *   WRITE OFF the count was right and the material is GONE — spoilt, mis-cut,
 *             or sent back to the supplier.
 *
 * A month of the two mixed together cannot tell you what the cutting table
 * costs, which is the whole reason the ledger separates ADJUST_* from WASTAGE.
 *
 * A reason is required either way. An adjustment nobody can explain afterwards
 * is the one entry that makes a whole ledger untrustworthy.
 */
export function AdjustStockDialog({
  material,
  onClose,
  onDone,
}: {
  material: Material;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"correct" | "writeOff">("correct");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const unit = UNIT_LABELS[material.unit] ?? material.unit;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);

    try {
      if (mode === "correct") {
        await api.adjust(
          material.id,
          Number(form.get("onHand") ?? 0) || 0,
          String(form.get("reason") ?? ""),
        );
      } else {
        await api.writeOff(
          material.id,
          Number(form.get("qty") ?? 0) || 0,
          String(form.get("type") ?? "WASTAGE") as "WASTAGE" | "RETURN_OUT",
          String(form.get("reason") ?? ""),
        );
      }

      await onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The count was not changed.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description={`${withUnit(material.onHand, material.unit)} on the shelf, ${withUnit(material.reserved, material.unit)} already promised to a run.`}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy} form="adjust-stock" type="submit" variant="solid">
            {busy ? "Saving…" : mode === "correct" ? "Correct the count" : "Write it off"}
          </Btn>
        </>
      }
      icon={Scale}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      title={material.name}
      tone="amber"
    >
      <Tabs
        inline
        label="How the count is changing"
        onChange={(next) => setMode(next as "correct" | "writeOff")}
        options={[
          { value: "correct", label: "Correct the count" },
          { value: "writeOff", label: "Write off" },
        ]}
        value={mode}
      />

      {/* Keyed on the mode so switching tabs gives each form its own fresh
          fields rather than carrying the other one's typing across. */}
      <form className="aui-form" id="adjust-stock" key={mode} onSubmit={submit}>
        {mode === "correct" ? (
          <Field
            help={`What the shelf actually holds, in ${unit}. It cannot go below what is already promised to a run.`}
            hint={unit}
            label="Counted"
          >
            <input
              defaultValue={material.onHand}
              min="0"
              name="onHand"
              required
              step="0.001"
              type="number"
            />
          </Field>
        ) : (
          <>
            <Field help={`How much is gone. Free stock only — a held quantity has to be released first.`} hint={unit} label="Amount">
              <input min="0" name="qty" placeholder="0" required step="0.001" type="number" />
            </Field>

            <Field label="What happened">
              <Select
                defaultValue="WASTAGE"
                name="type"
                options={[
                  { value: "WASTAGE", label: "Spoilt or mis-cut" },
                  { value: "RETURN_OUT", label: "Sent back to the supplier" },
                ]}
              />
            </Field>
          </>
        )}

        <Field
          full
          help="Recorded against this movement for good. Whoever reads the ledger in six months has only this sentence to go on."
          label="Why"
        >
          <input
            minLength={3}
            name="reason"
            placeholder={mode === "correct" ? "Stocktake, 26 Aug" : "Water damage on the end of the roll"}
            required
          />
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
