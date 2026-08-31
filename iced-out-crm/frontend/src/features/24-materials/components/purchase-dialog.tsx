"use client";

import { PackagePlus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, IconBtn, Modal, Note, Select } from "@/components/shell/admin-ui";
import { materials as api, useMaterials, usePurchase } from "@/features/24-materials/materials-api";
import { UNIT_LABELS, type Purchase, type Supplier } from "@/features/24-materials/types";

type Draft = { material: string; qty: string; unitCost: string };

/**
 * Writing a purchase order.
 *
 * The lines are edited as a SET and sent whole, because that is what a purchase
 * order is — a document, not a stream of rows. Sending it whole is also what
 * makes removing a line possible without a second endpoint: whatever is absent
 * from the payload has been taken off the order.
 *
 * Creating and editing are one component. They differ only in whether there is
 * an id to load lines for, and splitting them would give two forms that drift.
 */
export function PurchaseDialog({
  purchase,
  suppliers,
  onClose,
  onDone,
}: {
  /** Null when creating. */
  purchase: Purchase | null;
  suppliers: Supplier[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const editing = purchase !== null;
  const { materials: catalogue } = useMaterials({ status: "ACTIVE" });
  const { detail } = usePurchase(editing ? purchase.id : "");

  const [supplier, setSupplier] = useState(purchase?.supplier?.id ?? "");
  const [expectedOn, setExpectedOn] = useState(purchase?.expectedOn ?? "");
  const [lines, setLines] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Seeded from the server's own answer, once.
   *
   * Adjusted during render rather than in an effect: a setState in an effect
   * body paints the empty editor for a frame before filling it, and it is an
   * error in this repo besides. Keyed on the purchase id rather than a boolean,
   * because the detail reloads after a save — and letting that overwrite the
   * operator's in-progress typing is the bug this avoids.
   */
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (detail && seededFor !== detail.purchase.id) {
    setSeededFor(detail.purchase.id);
    setLines(
      detail.lines.map((line) => ({
        material: line.materialId,
        qty: line.ordered,
        unitCost: String(line.unitCostRaw),
      })),
    );
  }

  const locked = editing && purchase.status !== "DRAFT" && purchase.status !== "ORDERED";

  const setLine = (index: number, patch: Partial<Draft>) =>
    setLines((was) => was.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const addLine = () => setLines((was) => [...was, { material: "", qty: "", unitCost: "" }]);
  const dropLine = (index: number) => setLines((was) => was.filter((_, i) => i !== index));

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unitCost) || 0),
    0,
  );

  async function save() {
    if (busy) return;

    if (supplier === "") {
      setFailure("Choose who this is being ordered from.");
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      let id = purchase?.id ?? "";

      if (!editing) {
        const response = await api.createPurchase({ supplier, expectedOn: expectedOn || undefined });
        id = response.data.data.purchase.id;
      }

      /* Blank rows are the ones an operator added and then thought better of;
         dropping them here is kinder than refusing the whole save. */
      const usable = lines.filter((line) => line.material !== "" && Number(line.qty) > 0);

      if (usable.length > 0) {
        await api.setPurchaseLines(
          id,
          usable.map((line) => ({
            material: line.material,
            qty: Number(line.qty) || 0,
            unitCost: Number(line.unitCost) || 0,
          })),
        );
      }

      await onDone();
      toast.success(editing ? `${id} updated.` : `${id} drafted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That could not be saved.";
      setFailure(message);
      toast.error("The order was not saved.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description={
        locked
          ? "This order has started arriving, so its lines are fixed. Receive the rest, or cancel it."
          : "Add what is being bought and how much of it. Nothing reaches the material register until a delivery is received."
      }
      footNote={lines.length > 0 ? `${lines.length} line${lines.length === 1 ? "" : "s"}` : undefined}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy || locked} onClick={save} variant="solid">
            {busy ? "Saving…" : editing ? "Save order" : "Create draft"}
          </Btn>
        </>
      }
      icon={PackagePlus}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      size="wide"
      title={editing ? purchase.id : "New purchase order"}
    >
      <div className="aui-form">
        <Field label="Supplier">
          <Select
            disabled={editing}
            name="supplier"
            onValueChange={setSupplier}
            options={[
              { value: "", label: "Choose one" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={supplier}
          />
        </Field>

        <Field help="When it is due. Their lead time is the guide." label="Expected">
          <input
            disabled={locked}
            name="expectedOn"
            onChange={(event) => setExpectedOn(event.target.value)}
            type="date"
            value={expectedOn}
          />
        </Field>
      </div>

      <div className="mat-lines">
        <p className="mat-lines__head">
          <span>Material</span>
          <span>Quantity</span>
          <span>Cost each</span>
          <span />
        </p>

        {lines.map((line, index) => {
          const chosen = catalogue.find((m) => m.id === line.material);

          return (
            <div className="mat-lines__row" key={index}>
              <Select
                disabled={locked}
                name={`material-${index}`}
                onValueChange={(next) => {
                  const material = catalogue.find((m) => m.id === next);
                  /* Prefill the cost from the material, because the last price
                     paid is the best guess at the next one — and it stays
                     editable, because it is only a guess. */
                  setLine(index, {
                    material: next,
                    unitCost: line.unitCost || String(material?.unitCostRaw ?? ""),
                  });
                }}
                options={[
                  { value: "", label: "Choose a material" },
                  ...catalogue.map((m) => ({
                    value: m.id,
                    label: m.code ? `${m.name} — ${m.code}` : m.name,
                  })),
                ]}
                value={line.material}
              />

              <label className="mat-lines__qty">
                <input
                  disabled={locked}
                  min="0"
                  onChange={(event) => setLine(index, { qty: event.target.value })}
                  placeholder="0"
                  step="0.001"
                  type="number"
                  value={line.qty}
                />
                <span>{chosen ? UNIT_LABELS[chosen.unit] : ""}</span>
              </label>

              <label className="mat-lines__qty">
                <input
                  disabled={locked}
                  min="0"
                  onChange={(event) => setLine(index, { unitCost: event.target.value })}
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={line.unitCost}
                />
                <span>₹</span>
              </label>

              <IconBtn
                danger
                disabled={locked}
                icon={Trash2}
                label="Take this line off"
                onClick={() => dropLine(index)}
              />
            </div>
          );
        })}

        {!locked && (
          <Btn onClick={addLine} size="sm" variant="ghost">
            <Plus aria-hidden size={14} strokeWidth={2} /> Add a line
          </Btn>
        )}

        {lines.length > 0 && (
          <p className="mat-lines__total">
            Order total <b>₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
          </p>
        )}
      </div>

      {failure && (
        <Note icon={TriangleAlert} title="That did not save" tone="bad">
          {failure}
        </Note>
      )}
    </Modal>
  );
}
