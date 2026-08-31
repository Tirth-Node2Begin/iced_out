"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note } from "@/components/shell/admin-ui";
import { materials as api } from "@/features/24-materials/materials-api";
import type { Run } from "@/features/24-materials/types";

/**
 * Finishing a run.
 *
 * The one question it asks is HOW MANY ACTUALLY CAME OUT, and it is a question
 * rather than an assumption because a run of 40 that yields 38 has two rejects.
 * Recording 40 would put two pieces into the warehouse that nobody can pick, and
 * consume material for them besides.
 *
 * A short yield is handled properly on the server: material is consumed for what
 * was made, and the rest of the hold goes back on the shelf rather than staying
 * invisibly reserved.
 */
export function CompleteRunDialog({
  run,
  onClose,
  onDone,
}: {
  run: Run;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [produced, setProduced] = useState(String(run.qtyPlanned));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const made = Number(produced) || 0;
  const short = made < run.qtyPlanned;

  async function submit() {
    if (busy) return;

    setBusy(true);
    setFailure(null);

    try {
      await api.transitionRun(run.id, "complete", made);
      await onDone();
      toast.success(`${run.id} finished.`, {
        description: `${made} piece${made === 1 ? "" : "s"} added to ${run.item.name}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The run was not completed.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description={`${run.item.name} · ${run.qtyPlanned} planned. Its materials are held and will be consumed for whatever you record here.`}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy} onClick={submit} variant="solid">
            {busy ? "Finishing…" : `Finish with ${made}`}
          </Btn>
        </>
      }
      icon={Check}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      title={`Complete ${run.id}`}
      tone="mint"
    >
      <div className="aui-form">
        <Field
          full
          help="What actually came off the table. It cannot exceed what the run holds material for — plan a bigger run rather than over-producing this one."
          label="Pieces made"
        >
          <input
            max={run.qtyPlanned}
            min="0"
            onChange={(event) => setProduced(event.target.value)}
            step="1"
            type="number"
            value={produced}
          />
        </Field>
      </div>

      {short && (
        <Note title="A short yield">
          Material will be consumed for {made}, not {run.qtyPlanned}. The rest of the hold goes back
          on the shelf.
        </Note>
      )}

      {failure && (
        <Note icon={TriangleAlert} title="That did not save" tone="bad">
          {failure}
        </Note>
      )}
    </Modal>
  );
}
