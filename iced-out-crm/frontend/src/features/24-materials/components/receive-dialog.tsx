"use client";

import { Truck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Modal, Note } from "@/components/shell/admin-ui";
import { materials as api, usePurchase } from "@/features/24-materials/materials-api";
import { UNIT_LABELS, type Purchase } from "@/features/24-materials/types";

/**
 * A delivery arriving.
 *
 * Each line is prefilled with what is still OUTSTANDING, because the common
 * case is that the whole remainder turned up — and the operator's job is to
 * correct the exceptions, not to retype the rule.
 *
 * A short delivery is a first-class outcome: leave a line under its outstanding
 * figure and the order settles at "part received" with the balance still owed.
 * That is enforced server-side, so it holds however this dialog is used.
 */
export function ReceiveDialog({
  purchase,
  onClose,
  onDone,
}: {
  purchase: Purchase;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { detail, loading } = usePurchase(purchase.id);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Prefill from the order the moment it lands, and only then.
   *
   * Adjusted during render rather than in an effect — a setState in an effect
   * body paints the empty form for one frame and then fills it, and it is an
   * error in this repo besides. Keyed on the purchase id rather than a boolean,
   * so the detail reloading after a save cannot overwrite what the operator has
   * typed since.
   */
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (detail && seededFor !== detail.purchase.id) {
    const next: Record<string, string> = {};
    detail.lines.forEach((line) => {
      next[line.materialId] = line.outstanding;
    });

    setSeededFor(detail.purchase.id);
    setQty(next);
  }

  async function submit() {
    if (busy) return;

    const lines = Object.entries(qty)
      .map(([material, value]) => ({ material, qty: Number(value) || 0 }))
      .filter((line) => line.qty > 0);

    if (lines.length === 0) {
      setFailure("Nothing to receive — put a quantity against at least one line.");
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      await api.receive(purchase.id, lines);
      await onDone();
      toast.success(`${purchase.id} received.`, {
        description: "The material register and its ledger have been updated.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("Nothing was received.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const lines = detail?.lines ?? [];

  return (
    <Modal
      description={`What actually arrived from ${purchase.supplier?.name ?? "the supplier"}. Anything short leaves the order open.`}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy || lines.length === 0} onClick={submit} variant="solid">
            {busy ? "Receiving…" : "Receive delivery"}
          </Btn>
        </>
      }
      icon={Truck}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      size="wide"
      title={`Receive ${purchase.id}`}
      tone="mint"
    >
      {loading && lines.length === 0 && <p className="aui-muted">Reading the order…</p>}

      {lines.length > 0 && (
        <div className="mat-lines mat-lines--wide">
          <p className="mat-lines__head">
            <span>Material</span>
            <span>Ordered</span>
            <span>Already in</span>
            <span>Arriving now</span>
          </p>

          {lines.map((line) => (
            <div className="mat-lines__row mat-lines__row--receive" key={line.materialId}>
              <span className="mat-lines__name">
                <strong>{line.material}</strong>
                {line.code && <small>{line.code}</small>}
              </span>

              <span className="mat-lines__was">
                {line.ordered} {UNIT_LABELS[line.unit]}
              </span>

              <span className="mat-lines__was">
                {line.received} {UNIT_LABELS[line.unit]}
              </span>

              <label className="mat-lines__qty">
                <input
                  min="0"
                  onChange={(event) =>
                    setQty((was) => ({ ...was, [line.materialId]: event.target.value }))
                  }
                  step="0.001"
                  type="number"
                  value={qty[line.materialId] ?? ""}
                />
                <span>{UNIT_LABELS[line.unit]}</span>
              </label>
            </div>
          ))}
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
