"use client";

import { PackagePlus, Plus, Send, Truck, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AdminPage,
  Btn,
  Empty,
  Panel,
  Section,
  Status,
  type StatusTone,
} from "@/components/shell/admin-ui";
import { ChipFilter, Toolbar } from "@/components/shell/toolbar";
import { PurchaseDialog } from "@/features/24-materials/components/purchase-dialog";
import { ReceiveDialog } from "@/features/24-materials/components/receive-dialog";
import { materials as api, usePurchases, useSuppliers } from "@/features/24-materials/materials-api";
import { PURCHASE_LABELS, type Purchase, type PurchaseStatus } from "@/features/24-materials/types";

/**
 * Purchase orders — material on its way in.
 *
 * The state machine is the screen: DRAFT is being written, ORDERED has been
 * sent, PARTIAL has had some of it arrive, RECEIVED is closed. Only the middle
 * two can take a delivery, and the server enforces that — a draft quietly
 * adding metres nobody has bought is exactly what this module exists to stop.
 *
 * A short delivery leaves the order at PARTIAL rather than closing it, which is
 * the honest state for an order still owed forty metres.
 */
const STATUS_TONES: Record<PurchaseStatus, StatusTone> = {
  DRAFT: "idle",
  ORDERED: "info",
  PARTIAL: "warn",
  RECEIVED: "good",
  CANCELLED: "bad",
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open" },
  { value: "DRAFT", label: "Drafts" },
  { value: "RECEIVED", label: "Received" },
  { value: "all", label: "Everything" },
];

function PurchaseRow({
  purchase,
  onOpen,
  onReceive,
  onSend,
  onCancel,
}: {
  purchase: Purchase;
  onOpen: (purchase: Purchase) => void;
  onReceive: (purchase: Purchase) => void;
  onSend: (purchase: Purchase) => void;
  onCancel: (purchase: Purchase) => void;
}) {
  const canReceive = purchase.status === "ORDERED" || purchase.status === "PARTIAL";

  return (
    <li className="mat-po">
      <button className="mat-po__body" onClick={() => onOpen(purchase)} type="button">
        <span className="mat-po__id">{purchase.id}</span>
        <span className="mat-po__who">
          <strong>{purchase.supplier?.name ?? "No supplier"}</strong>
          <small>
            {purchase.lineCount} line{purchase.lineCount === 1 ? "" : "s"}
            {purchase.expectedOn ? ` · due ${purchase.expectedOn}` : ""}
            {purchase.orderedOn ? ` · sent ${purchase.orderedOn}` : ""}
          </small>
        </span>
        <b className="mat-po__total">{purchase.totalCost}</b>
      </button>

      <Status tone={STATUS_TONES[purchase.status]} value={PURCHASE_LABELS[purchase.status]} />

      <div className="mat-po__acts">
        {purchase.status === "DRAFT" && (
          <Btn onClick={() => onSend(purchase)} size="sm" variant="solid">
            <Send aria-hidden size={13} strokeWidth={1.8} /> Order
          </Btn>
        )}
        {canReceive && (
          <Btn onClick={() => onReceive(purchase)} size="sm" variant="solid">
            <Truck aria-hidden size={13} strokeWidth={1.8} /> Receive
          </Btn>
        )}
        {purchase.status !== "RECEIVED" && purchase.status !== "CANCELLED" && (
          <Btn onClick={() => onCancel(purchase)} size="sm" variant="ghost">
            <X aria-hidden size={13} strokeWidth={1.8} /> Cancel
          </Btn>
        )}
      </div>
    </li>
  );
}

export function PurchasesWorkspace() {
  const [status, setStatus] = useState("open");
  const { purchases, loading, error, loaded, reload } = usePurchases({ status });
  const { suppliers } = useSuppliers({ status: "ACTIVE" });

  const [editing, setEditing] = useState<Purchase | null>(null);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Purchase | null>(null);

  const after = useCallback(async () => {
    await reload();
  }, [reload]);

  const act = useCallback(
    async (purchase: Purchase, to: "order" | "cancel") => {
      try {
        await api.transitionPurchase(purchase.id, to);
        await after();
        toast.success(to === "order" ? `${purchase.id} sent to the supplier.` : `${purchase.id} cancelled.`);
      } catch (failure) {
        toast.error("That did not save.", {
          description: failure instanceof Error ? failure.message : undefined,
        });
      }
    },
    [after],
  );

  const totals = useMemo(
    () => ({
      open: purchases.filter((p) => p.status === "ORDERED" || p.status === "PARTIAL").length,
      drafts: purchases.filter((p) => p.status === "DRAFT").length,
    }),
    [purchases],
  );

  /* Counts for the chips. `purchases` holds what the CURRENT filter fetched, so
     these describe the visible set rather than the whole register — which is
     why only the selected chip and "Everything" can be trusted to agree with
     the table. Shown anyway: a count that moves as you filter still answers
     "how many am I looking at", and it is the same bargain every other register
     in the console makes. */
  const chipCounts = useMemo(
    () => ({
      open: totals.open,
      DRAFT: totals.drafts,
      RECEIVED: purchases.filter((p) => p.status === "RECEIVED").length,
      all: purchases.length,
    }),
    [purchases, totals],
  );

  return (
    <AdminPage
      eyebrow="Inventory"
      icon={PackagePlus}
      lede="Material on its way in. A delivery adds to the material register and writes a line in its ledger — a short one leaves the order open."
      spec={[
        { label: "Awaiting delivery", value: String(totals.open) },
        { label: "Drafts", value: String(totals.drafts) },
      ]}
      title={
        <>
          Purchase <em>orders</em>
        </>
      }
    >
      {/* Same three bands as every other register: where you are, the verb,
          and how you have narrowed it. This screen used to hide its status
          filter in the page header, a hero away from the rows it filtered. */}
      <Toolbar
        actions={
          <Btn onClick={() => setCreating(true)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> New order
          </Btn>
        }
        chips={<ChipFilter counts={chipCounts} onChange={setStatus} options={FILTERS} value={status} />}
      />

      <Section eyebrow="Incoming" title="Orders">
        <Panel>
          {loading && !loaded && <p className="aui-muted">Reading the orders…</p>}
          {error && <p className="aui-muted">{error}</p>}

          {loaded && purchases.length === 0 && (
            <Empty
              action={
                <Btn onClick={() => setCreating(true)} variant="solid">
                  <Plus aria-hidden size={15} strokeWidth={2} /> New order
                </Btn>
              }
              copy="An order starts as a draft, gets its lines, and is sent. Stock only moves when a delivery is received against it."
              icon={PackagePlus}
              inline
              title={status === "open" ? "Nothing on its way" : "No orders here"}
            />
          )}

          {purchases.length > 0 && (
            <ul className="mat-pos">
              {purchases.map((purchase) => (
                <PurchaseRow
                  key={purchase.id}
                  onCancel={(p) => act(p, "cancel")}
                  onOpen={setEditing}
                  onReceive={setReceiving}
                  onSend={(p) => act(p, "order")}
                  purchase={purchase}
                />
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      {(creating || editing) && (
        <PurchaseDialog
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await after();
          }}
          purchase={editing}
          suppliers={suppliers}
        />
      )}

      {receiving && (
        <ReceiveDialog
          onClose={() => setReceiving(null)}
          onDone={async () => {
            setReceiving(null);
            await after();
          }}
          purchase={receiving}
        />
      )}
    </AdminPage>
  );
}
