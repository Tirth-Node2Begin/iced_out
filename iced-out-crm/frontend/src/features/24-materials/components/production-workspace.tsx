"use client";

import { Check, Factory, Play, Plus, X } from "lucide-react";
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
import { InventoryTabs } from "@/features/03-inventory/components/inventory-tabs";
import { CompleteRunDialog } from "@/features/24-materials/components/complete-run-dialog";
import { RunDialog } from "@/features/24-materials/components/run-dialog";
import { materials as api, useRuns } from "@/features/24-materials/materials-api";
import { RUN_LABELS, type Run, type RunStatus } from "@/features/24-materials/types";

/**
 * Production runs — the point where the two halves of inventory meet.
 *
 * A run is the only thing in the system that consumes materials and creates
 * finished pieces, and it is a state machine so that both happen exactly once:
 *
 *   PLANNED   the recipe is frozen onto it. Nothing is held yet.
 *   STARTED   the materials it needs are HELD, so a second run cannot promise
 *             the same fleece. On hand does not move.
 *   DONE      the hold is consumed, the finished units land in the warehouse,
 *             and any surplus from a short yield goes back on the shelf.
 *   CANCELLED the hold is given back.
 *
 * All of that is enforced server-side inside one transaction. This screen is the
 * three buttons that ask for it.
 */
const STATUS_TONES: Record<RunStatus, StatusTone> = {
  PLANNED: "info",
  STARTED: "warn",
  DONE: "good",
  CANCELLED: "idle",
};

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "STARTED", label: "In production" },
  { value: "DONE", label: "Finished" },
  { value: "all", label: "Everything" },
];

function RunRow({
  run,
  onOpen,
  onStart,
  onComplete,
  onCancel,
}: {
  run: Run;
  onOpen: (run: Run) => void;
  onStart: (run: Run) => void;
  onComplete: (run: Run) => void;
  onCancel: (run: Run) => void;
}) {
  return (
    <li className="mat-run">
      <button className="mat-run__body" onClick={() => onOpen(run)} type="button">
        <span className="mat-run__id">{run.id}</span>
        <span className="mat-run__who">
          <strong>{run.item.name}</strong>
          <small>
            {run.status === "DONE"
              ? `${run.qtyProduced} made of ${run.qtyPlanned} planned`
              : `${run.qtyPlanned} planned`}
            {run.warehouse ? ` · ${run.warehouse.name}` : ""}
            {run.owner ? ` · ${run.owner.name}` : ""}
          </small>
        </span>
      </button>

      <Status tone={STATUS_TONES[run.status]} value={RUN_LABELS[run.status]} />

      <div className="mat-run__acts">
        {run.status === "PLANNED" && (
          <Btn onClick={() => onStart(run)} size="sm" variant="solid">
            <Play aria-hidden size={13} strokeWidth={1.8} /> Start
          </Btn>
        )}
        {run.status === "STARTED" && (
          <Btn onClick={() => onComplete(run)} size="sm" variant="solid">
            <Check aria-hidden size={13} strokeWidth={1.8} /> Complete
          </Btn>
        )}
        {(run.status === "PLANNED" || run.status === "STARTED") && (
          <Btn onClick={() => onCancel(run)} size="sm" variant="ghost">
            <X aria-hidden size={13} strokeWidth={1.8} /> Cancel
          </Btn>
        )}
      </div>
    </li>
  );
}

export function ProductionWorkspace() {
  const [status, setStatus] = useState("open");
  const { runs, summary, loading, error, loaded, reload } = useRuns({ status });

  /* Counts for the chips. `planned + started` is what "Open" means here, and it
     comes off the summary the endpoint returns rather than off `runs` -- the
     list only holds the current filter's rows, so counting it would make every
     chip but the selected one read zero. */
  const chipCounts = useMemo(
    () => ({
      open: summary.planned + summary.started,
      STARTED: summary.started,
      DONE: Math.max(summary.total - summary.planned - summary.started, 0),
      all: summary.total,
    }),
    [summary],
  );

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Run | null>(null);
  const [completing, setCompleting] = useState<Run | null>(null);

  const after = useCallback(async () => {
    await reload();
  }, [reload]);

  const start = useCallback(
    async (run: Run) => {
      try {
        await api.transitionRun(run.id, "start");
        await after();
        toast.success(`${run.id} started.`, {
          description: "Its materials are now held against it.",
        });
      } catch (failure) {
        /* The commonest failure here is "not enough of something", and the
           server's message names the material and the shortfall — so it is
           shown rather than replaced with a generic one. */
        toast.error("The run did not start.", {
          description: failure instanceof Error ? failure.message : undefined,
        });
      }
    },
    [after],
  );

  const cancel = useCallback(
    async (run: Run) => {
      try {
        await api.transitionRun(run.id, "cancel");
        await after();
        toast.success(`${run.id} cancelled.`, {
          description: run.status === "STARTED" ? "Its materials went back on the shelf." : undefined,
        });
      } catch (failure) {
        toast.error("That did not save.", {
          description: failure instanceof Error ? failure.message : undefined,
        });
      }
    },
    [after],
  );

  return (
    <AdminPage
      eyebrow="Inventory"
      icon={Factory}
      lede="Where materials become garments. Starting a run holds what its recipe needs; completing it consumes them and puts the finished pieces into stock."
      spec={[
        { label: "Planned", value: String(summary.planned) },
        { label: "In production", value: String(summary.started) },
        { label: "Pieces made", value: String(summary.unitsMade) },
      ]}
      title={
        <>
          Production <em>runs</em>
        </>
      }
    >
      {/* The same band the rest of the console uses -- see the note on the
          purchases screen; these two were the only registers that arranged
          their own. */}
      <Toolbar
        actions={
          <Btn onClick={() => setCreating(true)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> Plan a run
          </Btn>
        }
        chips={<ChipFilter counts={chipCounts} onChange={setStatus} options={FILTERS} value={status} />}
        lead={<InventoryTabs />}
      />

      <Section eyebrow="Making" title="Runs">
        <Panel>
          {loading && !loaded && <p className="aui-muted">Reading the runs…</p>}
          {error && <p className="aui-muted">{error}</p>}

          {loaded && runs.length === 0 && (
            <Empty
              action={
                <Btn onClick={() => setCreating(true)} variant="solid">
                  <Plus aria-hidden size={15} strokeWidth={2} /> Plan a run
                </Btn>
              }
              copy="A run needs a stock item with a recipe behind it. Set what a piece is made of on the material register first."
              icon={Factory}
              inline
              title={status === "open" ? "Nothing in production" : "No runs here"}
            />
          )}

          {runs.length > 0 && (
            <ul className="mat-runs">
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  onCancel={cancel}
                  onComplete={setCompleting}
                  onOpen={setViewing}
                  onStart={start}
                  run={run}
                />
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      {(creating || viewing) && (
        <RunDialog
          onClose={() => {
            setCreating(false);
            setViewing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setViewing(null);
            await after();
          }}
          run={viewing}
        />
      )}

      {completing && (
        <CompleteRunDialog
          onClose={() => setCompleting(null)}
          onDone={async () => {
            setCompleting(null);
            await after();
          }}
          run={completing}
        />
      )}
    </AdminPage>
  );
}
