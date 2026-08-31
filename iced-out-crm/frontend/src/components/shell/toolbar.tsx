"use client";

import type { ReactNode } from "react";

/**
 * The register toolbar, as one component.
 *
 * One rule decides where anything goes: FILTERS LEFT, VERBS RIGHT.
 *
 *   1. WHERE   the module tabs                              left
 *   2. HOW     dropdown filters (owner, date range …)       left, after the tabs
 *   3. WHAT    search, then the verbs (Export, New …)       search fills, verbs right
 *   4. HOW     the state chips                              a full line of their own
 *
 * So every screen reads the same way across: what you are looking at, how you
 * have narrowed it, then what you can do about it.
 *
 * It exists because it was inlined in `record-manager` and two screens that do
 * not use a register — /inventory/purchases and /inventory/production — grew
 * their own arrangement instead: a bare tab pill under the hero and the status
 * filter banished to the page header, twenty rows away from the rows it
 * filters. Same app, three grammars. One component is what stops that
 * happening again.
 *
 * `lead`, `search`, `actions` and `chips` are separate slots rather than
 * `children` on purpose — the wrapping rules in `console.css` depend on search
 * and actions being siblings inside `.aui-toolbar__controls`, so that the pair
 * moves to a new line together. Hand a caller `children` and that invariant
 * lasts until the first person who does not know about it.
 */
export function Toolbar({
  lead,
  filters,
  search,
  actions,
  chips,
}: {
  /** Module tabs. Keeps its natural width; gives it up last. */
  lead?: ReactNode;
  /**
   * Dropdown filters — an owner picker, a date range. Left, beside the tabs,
   * because narrowing a list is the same kind of act as choosing which list you
   * are on, and both answer "what am I looking at". Putting one of them next to
   * `New deal` instead is what made the pipeline board's toolbar read as a
   * cluster of unrelated controls floating at the right margin.
   */
  filters?: ReactNode;
  /** The search field, if the screen has one. Grows to fill its line. */
  search?: ReactNode;
  /** Verbs, right-aligned on whichever line they land on. */
  actions?: ReactNode;
  /** State chips. Always a full line of their own, under a hairline. */
  chips?: ReactNode;
}) {
  return (
    <div className="aui-toolbar">
      {lead}

      {filters && <div className="aui-toolbar__filters">{filters}</div>}

      {(search || actions) && (
        <div className="aui-toolbar__controls">
          {search}
          {actions && <div className="aui-toolbar__acts">{actions}</div>}
        </div>
      )}

      {chips}
    </div>
  );
}

/**
 * A row of state chips driven by one value.
 *
 * The register builds its own from the data (it can count the rows behind each
 * state); screens without a register pass a fixed vocabulary and get the same
 * pills, so "Open / Drafts / Received / Everything" reads the same on
 * /inventory/purchases as "All / Out / At risk / Healthy" does on
 * /inventory/materials.
 */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  /** Optional per-value count, shown in the chip. */
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="aui-chips">
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className="aui-chip"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
          {counts?.[option.value] !== undefined && <b>{counts[option.value]}</b>}
        </button>
      ))}
    </div>
  );
}
