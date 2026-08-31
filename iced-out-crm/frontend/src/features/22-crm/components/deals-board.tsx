"use client";

import { Handshake, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPage, Btn, Empty, Note, Select } from "@/components/shell/admin-ui";
import { Toolbar } from "@/components/shell/toolbar";
import { DealDialog } from "@/features/22-crm/components/deal-dialog";
import { crm, useBoard, useOwners } from "@/features/22-crm/crm-api";
import type { BoardColumn, Deal } from "@/features/22-crm/types";

/**
 * The pipeline.
 *
 * A board of stage columns, one card per deal, dragged between them. Three
 * things about it are deliberate:
 *
 *  1. A drop sends the cards it landed BETWEEN, not an index. The server ranks
 *     by those two neighbours, so two people dragging on the same board cannot
 *     reorder each other's work by disagreeing about what row 4 is.
 *  2. Nothing is optimistic. The card moves when the server says it moved. A
 *     board that shows a deal in a column the server rejected is worse than a
 *     board that takes 200ms — the whole value of this screen is that it is
 *     true.
 *  3. Dropping into Won or Lost SETTLES the deal — status, closed date and
 *     probability all follow the stage. A card sitting in the Won column while
 *     still marked open is the disagreement that makes every forecast wrong.
 *
 * Drag is HTML5 dnd rather than a library: the whole interaction is one card
 * onto one column, and `dataTransfer` carries the id without a dependency, a
 * sensor, or a portal. Every card is also reachable by keyboard through its own
 * stage select — drag is the shortcut, not the only route.
 */

function DealCard({
  deal,
  onDragStart,
  onOpen,
}: {
  deal: Deal;
  onDragStart: (id: string) => void;
  onOpen: (deal: Deal) => void;
}) {
  return (
    <article
      className="crm-card"
      data-settled={deal.status === "OPEN" ? "false" : "true"}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", deal.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(deal.id);
      }}
    >
      <button className="crm-card__open" onClick={() => onOpen(deal)} type="button">
        <span className="sr-only">Open {deal.title}</span>
      </button>

      <p className="crm-card__title">{deal.title}</p>

      <p className="crm-card__who">
        {deal.company?.name ?? deal.contact?.name ?? "No one attached"}
      </p>

      <div className="crm-card__foot">
        <b>{deal.amount}</b>
        <span className="crm-card__chance" title={`${deal.probability}% likely`}>
          {deal.probability}%
        </span>
      </div>

      <div className="crm-card__meta">
        {deal.owner && <span>{deal.owner.name}</span>}
        {deal.expectedCloseOn && <span>{deal.expectedCloseOn}</span>}
        {deal.openTasks > 0 && (
          <span data-tone="task">
            {deal.openTasks} task{deal.openTasks === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </article>
  );
}

function Column({
  column,
  dragging,
  onDrop,
  onOpen,
  onDragStart,
}: {
  column: BoardColumn;
  dragging: string | null;
  onDrop: (stage: string, before: string | null, after: string | null) => void;
  onOpen: (deal: Deal) => void;
  onDragStart: (id: string) => void;
}) {
  const [over, setOver] = useState(false);

  /**
   * Which two cards the pointer is between.
   *
   * Measured off the cards actually on screen rather than tracked in state:
   * the answer is only needed at the instant of the drop, and a `dragover`
   * handler that called setState would re-render the column sixty times a
   * second while the cursor crossed it.
   */
  const neighbours = (event: React.DragEvent<HTMLDivElement>) => {
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-deal]")];
    const y = event.clientY;

    let before: string | null = null;
    let after: string | null = null;

    for (const card of cards) {
      const id = card.dataset.deal ?? "";
      if (id === dragging) continue;

      const box = card.getBoundingClientRect();
      if (box.top + box.height / 2 < y) before = id;
      else if (after === null) after = id;
    }

    return { before, after };
  };

  return (
    <section className="crm-col" data-over={over ? "true" : "false"} data-kind={column.stage.kind}>
      <header className="crm-col__head">
        <p>
          {column.stage.name}
          <span>{column.count}</span>
        </p>
        <b>{column.value}</b>
      </header>

      <div
        className="crm-col__body"
        onDragLeave={(event) => {
          /* Only when the pointer has actually left the column — a dragleave
             fires for every child it crosses on the way through. */
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!over) setOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const { before, after } = neighbours(event);
          onDrop(column.stage.slug, before, after);
        }}
      >
        {column.deals.map((deal) => (
          <div data-deal={deal.id} key={deal.id}>
            <DealCard deal={deal} onDragStart={onDragStart} onOpen={onOpen} />
          </div>
        ))}

        {column.deals.length === 0 && <p className="crm-col__empty">Nothing here</p>}
      </div>
    </section>
  );
}

export function DealsBoard() {
  const [owner, setOwner] = useState("all");
  const { board, loading, error, loaded, reload } = useBoard({ owner });
  const { owners } = useOwners();
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [moveFailure, setMoveFailure] = useState<string | null>(null);

  const move = useCallback(
    async (stage: string, before: string | null, after: string | null) => {
      const id = dragging;
      setDragging(null);
      if (!id) return;

      setMoveFailure(null);

      try {
        await crm.moveDeal(id, stage, before ?? undefined, after ?? undefined);
        await reload();
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : "That move was not saved.";
        setMoveFailure(message);
        toast.error("The deal did not move.", { description: message });
        /* Re-read anyway: the board may be stale for the reason the move was
           refused, and showing the true state is the point of the screen. */
        await reload();
      }
    },
    [dragging, reload],
  );

  const stages = useMemo(
    () => board?.columns.map((column) => column.stage) ?? [],
    [board],
  );

  const summary = board?.summary;

  return (
    <AdminPage
      eyebrow="Relationships"
      icon={Handshake}
      lede="Every conversation worth money, and where it has got to. Dropping a card into Won or Lost settles the deal — its close date and its odds follow the column."
      spec={
        summary
          ? [
              { label: "Open", value: summary.openValue },
              { label: "Weighted", value: summary.weightedValue },
              { label: "Won", value: summary.wonValue },
              {
                label: "Win rate",
                /* Null and 0% mean opposite things, and a tile cannot show the
                   difference — so say it in words. */
                value: summary.winRate === null ? "Nothing settled yet" : `${summary.winRate}%`,
              },
            ]
          : undefined
      }
      title={
        <>
          The <em>pipeline</em>
        </>
      }
    >
      {/* The board's own controls, in the band the rest of the console uses.
          There are no chips here -- the stage columns ARE the states, so a row
          of pills repeating them would be a second, weaker copy of the board. */}
      <Toolbar
        actions={
          <Btn onClick={() => setCreating(true)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> New deal
          </Btn>
        }
        filters={
          <Select
            aria-label="Filter by owner"
            name="owner"
            onValueChange={setOwner}
            options={[
              { value: "all", label: "Everyone" },
              { value: "me", label: "Mine" },
              { value: "unassigned", label: "Unassigned" },
              ...owners.map((staff) => ({ value: staff.id, label: staff.name })),
            ]}
            value={owner}
          />
        }
      />

      {error && (
        <Note icon={TriangleAlert} title="The board could not be read" tone="bad">
          {error}
        </Note>
      )}

      {moveFailure && (
        <Note icon={TriangleAlert} title="That move was refused" tone="warn">
          {moveFailure} The board below is what the server currently holds.
        </Note>
      )}

      {loading && !loaded && <p className="aui-muted">Reading the pipeline…</p>}

      {board && board.columns.every((column) => column.count === 0) && (
        <Empty
          action={
            <Btn onClick={() => setCreating(true)} variant="solid">
              <Plus aria-hidden size={15} strokeWidth={2} /> New deal
            </Btn>
          }
          copy="Qualifying a lead opens one automatically, which is how this board usually fills. Add one by hand for a conversation that started somewhere else."
          icon={Handshake}
          title="No deals yet"
        />
      )}

      {board && !board.columns.every((column) => column.count === 0) && (
        <div className="crm-board" onDragEnd={() => setDragging(null)}>
          {board.columns.map((column) => (
            <Column
              column={column}
              dragging={dragging}
              key={column.stage.id}
              onDragStart={setDragging}
              onDrop={move}
              onOpen={setEditing}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <DealDialog
          deal={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={async () => {
            setCreating(false);
            setEditing(null);
            await reload();
          }}
          owners={owners}
          pipeline={board?.pipeline.slug ?? ""}
          stages={stages}
        />
      )}
    </AdminPage>
  );
}
