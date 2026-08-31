"use client";

import { Factory, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import { materials as api, useRun } from "@/features/24-materials/materials-api";
import { useRegisterList } from "@/api/use-register";
import { useStock } from "@/features/03-inventory/stock-context";
import { RUN_LABELS, UNIT_LABELS, type Run } from "@/features/24-materials/types";

/**
 * Planning a run, and reading one back.
 *
 * The table underneath is the whole point: for every material the recipe calls
 * for, what this run NEEDS against what is FREE. A line that cannot be met is
 * marked, and `canStart` — answered by the server, not guessed here — is what
 * the Start button reads.
 *
 * On an existing run the same table shows what was held and what was consumed,
 * so the document explains itself after the fact as well as before it.
 */
export function RunDialog({
  run,
  onClose,
  onDone,
}: {
  /** Null when planning a new one. */
  run: Run | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const viewing = run !== null;
  const { items } = useStock();
  const { rows: warehouses } = useRegisterList("/admin/inventory/warehouses");
  const { detail } = useRun(viewing ? run.id : "");

  const [item, setItem] = useState("");
  const [warehouse, setWarehouse] = useState("none");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function create() {
    if (busy) return;

    if (item === "" || Number(qty) < 1) {
      setFailure("Pick what is being made and how many.");
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      const response = await api.createRun({
        item,
        qty: Number(qty) || 0,
        warehouse: warehouse === "none" ? undefined : warehouse,
      });

      await onDone();
      toast.success(`${response.data.data.run.id} planned.`, {
        description: "Its recipe is frozen onto it. Start it when the materials are ready.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The run was not planned.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const lines = detail?.lines ?? [];
  const settled = viewing && (run.status === "DONE" || run.status === "CANCELLED");

  return (
    <Modal
      description={
        viewing
          ? `${RUN_LABELS[run.status]} · ${run.item.name}`
          : "A run freezes the item's recipe onto it, so a later change to what a garment is made of never rewrites history."
      }
      footer={
        viewing ? (
          <Btn onClick={onClose} variant="ghost">
            Close
          </Btn>
        ) : (
          <>
            <Btn disabled={busy} onClick={onClose} variant="ghost">
              Cancel
            </Btn>
            <Btn disabled={busy} onClick={create} variant="solid">
              {busy ? "Planning…" : "Plan the run"}
            </Btn>
          </>
        )
      }
      icon={Factory}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      size="wide"
      title={viewing ? run.id : "Plan a production run"}
    >
      {!viewing && (
        <div className="aui-form">
          <Field full label="What is being made">
            <Select
              name="item"
              onValueChange={setItem}
              options={[
                { value: "", label: "Choose a stock item" },
                ...items.map((stockItem) => ({
                  value: stockItem.id,
                  label: `${stockItem.itemName} — ${stockItem.itemType}`,
                })),
              ]}
              value={item}
            />
          </Field>

          <Field
            help="What the run is for. Fewer may come out of it, and that is recorded when it finishes."
            label="How many"
          >
            <input
              min="1"
              onChange={(event) => setQty(event.target.value)}
              placeholder="40"
              step="1"
              type="number"
              value={qty}
            />
          </Field>

          <Field label="Into which warehouse">
            <Select
              name="warehouse"
              onValueChange={setWarehouse}
              options={[
                { value: "none", label: "The item's own" },
                ...warehouses.map((w) => ({ value: w.id, label: w.name })),
              ]}
              value={warehouse}
            />
          </Field>
        </div>
      )}

      {viewing && lines.length > 0 && (
        <div className="mat-lines mat-lines--wide">
          <p className="mat-lines__head">
            <span>Material</span>
            <span>Per piece</span>
            <span>{settled ? "Used" : "Needs"}</span>
            <span>Free</span>
          </p>

          {lines.map((line) => (
            <div
              className="mat-lines__row mat-lines__row--run"
              data-short={line.short ? "true" : "false"}
              key={line.materialId}
            >
              <span className="mat-lines__name">
                <strong>{line.material}</strong>
                {line.wastagePct > 0 && <small>{line.wastagePct}% cutting loss included</small>}
              </span>

              <span className="mat-lines__was">
                {line.perUnit} {UNIT_LABELS[line.unit]}
              </span>

              <span className="mat-lines__need">
                {settled ? line.consumed : line.required} {UNIT_LABELS[line.unit]}
              </span>

              <span className="mat-lines__was">
                {line.available} {UNIT_LABELS[line.unit]}
                {line.short && <em> short</em>}
              </span>
            </div>
          ))}

          {detail && !detail.canStart && run?.status === "PLANNED" && (
            <Note icon={TriangleAlert} title="Not enough to start" tone="warn">
              At least one material is short. Receive a delivery, or plan a smaller run.
            </Note>
          )}
        </div>
      )}

      {failure && (
        <Note icon={TriangleAlert} title="That did not save" tone="bad">
          {failure}
        </Note>
      )}
    </Modal>
  );
}
