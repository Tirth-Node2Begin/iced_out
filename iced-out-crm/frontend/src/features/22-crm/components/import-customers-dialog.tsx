"use client";

import { Download, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Btn, Empty, Field, Modal, Note, Select } from "@/components/shell/admin-ui";
import { crm } from "@/features/22-crm/crm-api";
import type { StaffOwner } from "@/features/22-crm/types";

type Importable = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  ordersTotal: string;
};

/**
 * The answer to "the CRM was installed after the shop had already been trading".
 *
 * It lists shopper accounts that no contact record points at yet — the
 * storefront already knows these people, and retyping them would be absurd.
 * Sorted by what they have spent, because if you are only going to import the
 * top twenty, those are the twenty.
 *
 * Anyone already linked is skipped server-side rather than failing the batch:
 * two operators running this at once must not produce an error and a
 * half-finished import.
 */
export function ImportCustomersDialog({
  owners,
  onClose,
  onDone,
}: {
  owners: StaffOwner[];
  onClose: () => void;
  onDone: (result: { created: number; skipped: number }) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Importable[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [owner, setOwner] = useState("none");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const customers = await crm.importableCustomers();
        if (!live) return;
        setRows(customers);
        /* Everything ticked to start with. The common case is "bring them all
           in", and un-ticking three is less work than ticking forty. */
        setChosen(new Set(customers.map((customer) => customer.id)));
      } catch (error) {
        if (!live) return;
        setFailure(error instanceof Error ? error.message : "That list could not be read.");
        setRows([]);
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  const toggle = (id: string) =>
    setChosen((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run() {
    if (busy || chosen.size === 0) return;
    setBusy(true);
    setFailure(null);

    try {
      await onDone(await crm.importCustomers([...chosen], owner));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The import did not finish.";
      setFailure(message);
      toast.error("Nothing was imported.", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const all = rows ?? [];

  return (
    <Modal
      description="Shopper accounts with no contact record yet. Everything about them stays where it is — this only writes the contact that points at it."
      footNote={rows === null ? undefined : `${chosen.size} of ${all.length} selected`}
      footer={
        <>
          <Btn disabled={busy} onClick={onClose} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={busy || chosen.size === 0} onClick={run} variant="solid">
            {busy ? "Importing…" : `Import ${chosen.size}`}
          </Btn>
        </>
      }
      icon={Download}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      size="wide"
      title="Import from the storefront"
    >
      {failure && (
        <Note icon={TriangleAlert} title="That did not work" tone="bad">
          {failure}
        </Note>
      )}

      {rows === null && <p className="aui-muted">Reading the customer register…</p>}

      {rows !== null && all.length === 0 && !failure && (
        <Empty
          copy="Every shopper with an account already has a contact record. Anyone else — a wholesale buyer, a stylist — has no storefront account to import, so add them by hand."
          icon={Download}
          inline
          title="Nothing left to import"
        />
      )}

      {all.length > 0 && (
        <>
          <Field label="Give them all to">
            <Select
              name="owner"
              onValueChange={setOwner}
              options={[
                { value: "none", label: "Unassigned" },
                ...owners.map((staff) => ({ value: staff.id, label: staff.name })),
              ]}
              value={owner}
            />
          </Field>

          <div className="crm-import">
            {all.map((row) => (
              <label className="aui-check crm-import__row" key={row.id}>
                <input
                  checked={chosen.has(row.id)}
                  onChange={() => toggle(row.id)}
                  type="checkbox"
                  value={row.id}
                />
                <span aria-hidden className="aui-check__box" />
                <span className="aui-check__copy">
                  <strong>{row.name}</strong>
                  <small>{row.email}</small>
                </span>
                <span className="crm-import__spend">
                  <b>{row.ordersTotal}</b>
                  <small>
                    {row.ordersCount} order{row.ordersCount === 1 ? "" : "s"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
