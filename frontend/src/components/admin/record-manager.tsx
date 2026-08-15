"use client";

import {
  ArrowRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import {
  Btn,
  ConfirmDialog,
  Empty,
  Field,
  IconBtn,
  Modal,
  Select,
  Status,
  optionDisabled,
  optionValue,
  type SelectOption,
  type StatusTone,
  type Tone,
} from "@/components/admin/admin-ui";

/**
 * The console's list screen — one component behind every register in `/admin`.
 *
 * Everything an operator can do to a set of records is here and in the same
 * place on every screen: search it, narrow it by state, add one, edit one,
 * delete one, export what is visible. A page declares its columns and its form
 * and gets the whole verb set; nothing has to reimplement a dialog, and no two
 * screens end up with the delete button in different corners.
 *
 * Records are flat `string` maps on purpose. Every value in this console is
 * either a label, an id, a money string or a date string, and keeping them all
 * one type is what lets a single form renderer cover eighty screens.
 */

export type RecordRow = Record<string, string>;

export type Column = {
  key: string;
  label: string;
  align?: "right" | "center";
  /** Steps out of the table on a phone, where a wide row is a scroll anyway. */
  hideSmall?: boolean;
  /** The identifying cell — rendered heavier, with an optional second line. */
  primary?: boolean;
  /** Key of a second, quieter line under a primary cell. */
  sub?: string;
  /** Renders the value as a status pill. */
  status?: boolean;
  /** Tabular figures, for anything that is counted or priced. */
  numeric?: boolean;
  render?: (row: RecordRow) => ReactNode;
  /**
   * What this column writes to CSV. Needed only by a column computed in
   * `render`, where there is no `key` on the record for the export to read —
   * without it the column exports blank.
   */
  exportValue?: (row: RecordRow) => string;
};

export type FormField = {
  key: string;
  label: string;
  /**
   * `chips` is the many-valued cousin of `select` — the whole vocabulary laid
   * out as toggles, for a field like sizes where an item is genuinely several
   * of them at once. It stores what was picked as one comma-joined string, so a
   * record stays the flat string map the rest of this component relies on.
   */
  type?: "text" | "number" | "select" | "textarea" | "date" | "chips";
  options?: SelectOption[];
  /**
   * Options read off the rest of the form instead of declared up front, for a
   * field whose vocabulary is only knowable once something else is answered —
   * the sizes a chosen inventory item is actually stocked in.
   *
   * The register keeps such a form under watch while it is open, and moves an
   * answer that its own source no longer offers on to one that it does. A form
   * therefore cannot be submitted holding a combination the data behind it does
   * not have.
   *
   * `previous` is the record being edited, so a vocabulary that excludes what
   * is already taken can still offer this record its own answer back.
   */
  optionsFor?: (values: RecordRow, previous?: RecordRow) => SelectOption[];
  placeholder?: string;
  hint?: string;
  help?: string;
  required?: boolean;
  full?: boolean;
  /** Prefill for a new record. */
  initial?: string;
  /** Bounds for a number field — a count or a price never goes negative. */
  min?: string;
  step?: string;
};

/**
 * The one verb a register offers on a row — confirming an order, approving a
 * return. Declared rather than wired: the page says what the action means and
 * what it writes, and this component owns the state change, the undo and the
 * toast, so no two registers grow different behaviour for the same gesture.
 */
export type RowAction = {
  icon: LucideIcon;
  /** Names the action for the tooltip and for screen readers. */
  label: string;
  /** What the record becomes. Undo comes free with it. */
  patch?: RecordRow;
  /**
   * For a verb whose consequences reach past this row — cancelling an order
   * also cancels the parcel carrying it — the register hands the change to the
   * store that owns both instead of writing the row itself. No undo is offered
   * for one of these, because this component cannot know how to reverse it.
   */
  onSelect?: () => void;
  tone?: "good" | "danger";
  /** Shown, but held — for a row where the verb is right but not yet legal. */
  disabled?: boolean;
  toast?: { title: string; description?: string };
};

export type RecordManagerProps = {
  /** "order", "coupon" — used in every label the component writes. */
  singular: string;
  plural?: string;
  icon?: LucideIcon;
  tone?: Tone;
  columns: Column[];
  fields: FormField[];
  /** What the register holds when it owns its own rows. */
  initial?: RecordRow[];
  /**
   * Rows held somewhere that outlives the screen — a context, a store. Pass it
   * with `onCommit` and the register stops keeping its own copy, so a record
   * created here is still there after a navigation or a reload.
   */
  rows?: RecordRow[];
  /**
   * Applies one change to whatever is behind `rows`. It takes an updater
   * rather than a list because an undo can fire long after the render that
   * offered it, and it still has to build on what is current.
   */
  onCommit?: (next: (current: RecordRow[]) => RecordRow[]) => void;
  /**
   * Fills in what the form deliberately does not ask for — a slug minted from
   * a name, a stock code. Runs on create and on edit; `previous` is the record
   * being edited, and is undefined on a create.
   */
  derive?: (values: RecordRow, rows: RecordRow[], previous?: RecordRow) => RecordRow;
  /**
   * The last word on whether the form may be submitted, for a rule this
   * component cannot see — stock that has already been spoken for, a name
   * that has to be unique against something other than the id.
   *
   * Return the sentence to refuse with, or null to allow. It runs after
   * `derive`, so it judges the record as it would actually be written. A
   * disabled option in the form is what stops most of these being reachable at
   * all; this is the wall behind that, for the ones that are not — a second tab
   * that listed the last piece while this dialog was open.
   */
  validate?: (values: RecordRow, rows: RecordRow[], previous?: RecordRow) => string | null;
  /** Which key identifies a record. */
  idKey?: string;
  /** Used to mint an id when the form does not collect one. */
  idPrefix?: string;
  /** Turns the values of this column into the filter chips. */
  filterKey?: string;
  /**
   * Drops the chips onto their own band under the toolbar instead of sitting
   * them beside the search field. Worth it where the vocabulary is long enough
   * to wrap, since a filter row that reflows as you type pushes the buttons
   * beside it around.
   */
  filtersBelow?: boolean;
  /**
   * The order those chips sit in. Without it they follow the order the values
   * happen to appear in, which means a chip moves under the cursor the moment
   * a row changes state — pass the register's own vocabulary instead.
   */
  filterOrder?: string[];
  /**
   * The chips, stated outright rather than read off the rows. Use it when the
   * register's states are fixed: the chip for a state nobody is in stays put
   * and reads zero, instead of vanishing and shifting the row under the
   * cursor. `[]` leaves just "All" — a register with one state still says so.
   */
  filterValues?: string[];
  /** Which keys search reads. Defaults to every key in the first record. */
  searchKeys?: string[];
  /** A per-row destination — adds an "open" chevron at the end of the row. */
  rowHref?: (row: RecordRow) => string;
  /**
   * The one move an operator makes over and over on this register, rendered
   * first in the row's action group — which the table already holds at low
   * contrast until the row is hovered or tabbed into. Return `null` for a row
   * the verb cannot apply to, so a row never offers an action that would do
   * nothing.
   */
  rowAction?: (row: RecordRow) => RowAction | RowAction[] | null;
  /** Called whenever the register changes, so a page can count what is in it. */
  onRowsChange?: (rows: RecordRow[]) => void;
  /** Extra controls beside the search field. */
  toolbarExtra?: ReactNode;
  /** Sits at the head of the toolbar, before search — a module's own tabs. */
  toolbarLead?: ReactNode;
  /** Rendered above the table — a note, a callout, a sub-section. */
  children?: ReactNode;
  /** Turn the create/edit/delete verbs off for a register that is a ledger. */
  readOnly?: boolean;
  /** Copy under the empty state, when the register has never had a record. */
  emptyHint?: string;
  /** Overrides the automatic tone for the status column. */
  statusTone?: (row: RecordRow) => StatusTone | undefined;
};

/** A record's own words, for search — ids and labels alike. */
function haystack(row: RecordRow, keys: string[]) {
  return keys
    .map((key) => row[key] ?? "")
    .join(" ")
    .toLowerCase();
}

export function RecordManager({
  singular,
  plural,
  icon: Icon,
  tone = "ink",
  columns,
  fields,
  initial,
  rows: given,
  onCommit,
  derive,
  validate,
  idKey = "id",
  idPrefix,
  filterKey,
  filtersBelow,
  filterOrder,
  filterValues,
  searchKeys,
  rowHref,
  rowAction,
  onRowsChange,
  toolbarExtra,
  toolbarLead,
  children,
  readOnly,
  emptyHint,
  statusTone,
}: RecordManagerProps) {
  const many = plural ?? `${singular}s`;
  /* Kept, but unused the moment a store is passed in — `given` is then the
     only truth, and a second copy here would be a copy that drifts. */
  const [own, setOwn] = useState<RecordRow[]>(initial ?? []);
  const rows = given ?? own;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  /* `undefined` = closed, `null` = creating, a row = editing that row. */
  const [draft, setDraft] = useState<RecordRow | null | undefined>(undefined);
  const [doomed, setDoomed] = useState<RecordRow | undefined>(undefined);

  /**
   * What the open form is currently holding.
   *
   * Only kept for a form that has a field reading the others — everywhere else
   * the inputs stay uncontrolled and `FormData` at submit is the only time
   * anyone asks what they say, which is the cheaper arrangement and the one
   * eighty screens already rely on.
   */
  const dependent = fields.some((field) => field.optionsFor);
  const [formValues, setFormValues] = useState<RecordRow>({});

  /** A field's vocabulary, which may be a question about the other answers. */
  function choicesOf(field: FormField, values: RecordRow, record?: RecordRow): SelectOption[] {
    return field.optionsFor ? field.optionsFor(values, record) : (field.options ?? []);
  }

  /** The first choice a form is allowed to hold — never one that is shown held. */
  function firstOpen(choices: SelectOption[]) {
    const open = choices.find((choice) => !optionDisabled(choice));
    return open === undefined ? "" : optionValue(open);
  }

  /** What the form starts holding — an edited record, or the declared defaults. */
  function seed(record: RecordRow | null): RecordRow {
    const values: RecordRow = {};
    /* In order, so a dependent field resolves against the answers above it —
       which is the order they are asked in. */
    for (const field of fields) {
      values[field.key] =
        record?.[field.key] ??
        field.initial ??
        firstOpen(choicesOf(field, values, record ?? undefined));
    }
    return values;
  }

  function openDraft(record: RecordRow | null) {
    setDraft(record);
    setFormValues(seed(record));
  }

  function update(key: string, value: string) {
    const record = draft ?? undefined;

    setFormValues((current) => {
      const next = { ...current, [key]: value };

      /* An answer that hung off the one just changed may not be on offer any
         more — a size the newly picked item is not stocked in. It moves to the
         first that is, rather than being left standing as a value its own
         source no longer has. */
      for (const field of fields) {
        if (!field.optionsFor || field.key === key) continue;
        const choices = choicesOf(field, next, record);
        const open = choices.filter((choice) => !optionDisabled(choice)).map(optionValue);
        if (!open.includes(next[field.key] ?? "")) next[field.key] = open[0] ?? "";
      }

      return next;
    });
  }

  /* Ids are minted from a counter rather than a clock: a stable sequence keeps
     the list readable, and nothing here is persisted, so uniqueness only has
     to hold for the session. */
  const nextId = useRef(1);

  /**
   * The next free id in the sequence.
   *
   * It steps over anything already taken rather than trusting the counter,
   * because a register backed by a store starts with rows this component never
   * saw — counting from one there would mint an id that already exists.
   */
  function mintId(current: RecordRow[]) {
    const prefix = idPrefix ?? singular.slice(0, 3).toUpperCase();
    const taken = new Set(current.map((row) => row[idKey]));
    let id = `${prefix}-${String(nextId.current).padStart(3, "0")}`;
    while (taken.has(id)) {
      nextId.current += 1;
      id = `${prefix}-${String(nextId.current).padStart(3, "0")}`;
    }
    nextId.current += 1;
    return id;
  }

  const keys = searchKeys ?? Object.keys(rows[0] ?? initial?.[0] ?? {});

  const filters = useMemo(() => {
    if (filterValues) return ["All", ...filterValues];
    if (!filterKey) return [];
    const present = new Set(rows.map((row) => row[filterKey]).filter(Boolean));
    const seen = filterOrder
      ? filterOrder.filter((value) => present.has(value))
      : Array.from(present);
    return seen.length > 1 ? ["All", ...seen] : [];
  }, [filterKey, filterOrder, filterValues, rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !needle || haystack(row, keys).includes(needle);
      const matchesFilter = !filterKey || filter === "All" || row[filterKey] === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, filterKey, keys, query, rows]);

  const editing = draft !== null && draft !== undefined;

  /**
   * Every change to the register goes through here, so the page above it hears
   * about the change in the same event that caused it. The mirror is a ref
   * rather than the `rows` closure because an undo handler can fire long after
   * the render that created it, and it still has to build on what is current.
   */
  const live = useRef(rows);

  function commit(next: (current: RecordRow[]) => RecordRow[]) {
    /* A store owns the sequencing itself — it reads its own current value and
       writes the result — so the updater is handed straight over. */
    if (onCommit) {
      onCommit(next);
      return;
    }

    const updated = next(live.current);
    live.current = updated;
    setOwn(updated);
    onRowsChange?.(updated);
  }

  /** Moves one record on, and offers the way back where there is one. */
  function apply(row: RecordRow, action: RowAction) {
    if (action.onSelect) {
      action.onSelect();
      if (action.toast) toast.success(action.toast.title, { description: action.toast.description });
      return;
    }

    const patch = action.patch ?? {};
    const before: RecordRow = {};
    for (const key of Object.keys(patch)) before[key] = row[key] ?? "";

    write(row, patch);

    if (action.toast) {
      toast.success(action.toast.title, {
        description: action.toast.description,
        action: { label: "Undo", onClick: () => write(row, before) },
      });
    }
  }

  function write(row: RecordRow, values: RecordRow) {
    commit((current) =>
      current.map((entry) => (entry[idKey] === row[idKey] ? { ...entry, ...values } : entry)),
    );
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typed: RecordRow = {};
    for (const field of fields) typed[field.key] = String(form.get(field.key) ?? "").trim();

    /* A `chips` field carries its value in a hidden input, which the browser
       excludes from constraint validation — so a required one is checked here
       rather than by `required` on the element. */
    const missing = fields.find(
      (field) => field.type === "chips" && field.required && !typed[field.key],
    );
    if (missing) {
      toast.error(`${missing.label}: pick at least one.`);
      return;
    }

    /* `null` is "creating", a row is "editing that row" — both collapse to the
       one question `derive` and the branch below actually ask. */
    const previous = draft ?? undefined;
    const values = derive ? derive(typed, rows, previous) : typed;

    /* Judged as it would be written, and refused before anything is. The
       dialog stays open holding what was typed, so the answer that has to
       change is still on screen next to the reason. */
    const refusal = validate?.(values, rows, previous) ?? null;
    if (refusal) {
      toast.error(`This ${singular} cannot be ${previous ? "saved" : "created"}`, {
        description: refusal,
      });
      return;
    }

    if (previous) {
      const id = previous[idKey];
      commit((current) => current.map((row) => (row[idKey] === id ? { ...row, ...values } : row)));
      toast.success(`${sentence(singular)} updated`, { description: label(values, fields, id) });
    } else {
      const id = values[idKey] || mintId(rows);
      commit((current) => [{ ...values, [idKey]: id }, ...current]);
      toast.success(`${sentence(singular)} created`, { description: label(values, fields, id) });
    }

    setDraft(undefined);
  }

  function remove(row: RecordRow) {
    commit((current) => current.filter((entry) => entry[idKey] !== row[idKey]));
    toast.success(`${sentence(singular)} deleted`, {
      description: `${row[idKey]} was removed from this register.`,
      action: {
        label: "Undo",
        onClick: () => commit((current) => [row, ...current]),
      },
    });
  }

  function exportCsv() {
    const head = columns.map((column) => column.label);
    const body = visible.map((row) =>
      columns.map((column) => {
        const value = column.exportValue?.(row) ?? row[column.key] ?? "";
        return `"${String(value).replaceAll('"', '""')}"`;
      }),
    );
    const csv = [head.join(","), ...body.map((line) => line.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${many.replaceAll(" ", "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready", { description: `${visible.length} rows written to CSV.` });
  }

  const filtered = query.trim() !== "" || filter !== "All";

  const chips = filters.length > 0 && (
    <div className="aui-chips">
      {filters.map((entry) => (
        <button
          aria-pressed={filter === entry ? "true" : "false"}
          className="aui-chip"
          key={entry}
          onClick={() => setFilter(entry)}
          type="button"
        >
          {entry}
          <b>
            {entry === "All" || !filterKey
              ? rows.length
              : rows.filter((row) => row[filterKey] === entry).length}
          </b>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="aui-toolbar">
        {toolbarLead}

        <span className="aui-searchfield">
          <Search aria-hidden size={15} strokeWidth={1.7} />
          <input
            aria-label={`Search ${many}`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${many}`}
            value={query}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} type="button">
              <X aria-hidden size={14} strokeWidth={1.9} />
            </button>
          )}
        </span>

        {!filtersBelow && chips}

        {toolbarExtra}

        <Btn onClick={exportCsv} size="sm">
          <Download aria-hidden size={14} strokeWidth={1.7} /> Export
        </Btn>

        {!readOnly && (
          <Btn onClick={() => openDraft(null)} size="sm" variant="solid">
            <Plus aria-hidden size={14} strokeWidth={2} /> New {singular}
          </Btn>
        )}
      </div>

      {filtersBelow && chips && <div className="aui-filterbar">{chips}</div>}

      {children}

      {visible.length === 0 ? (
        <Empty
          action={
            filtered ? (
              <Btn
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
              >
                Clear filters
              </Btn>
            ) : readOnly ? undefined : (
              <Btn onClick={() => openDraft(null)} variant="solid">
                <Plus aria-hidden size={14} strokeWidth={2} /> New {singular}
              </Btn>
            )
          }
          copy={
            filtered
              ? `Nothing in ${many} matches that search. Clear the filters to see the whole register.`
              : (emptyHint ?? `Nothing here yet. Add the first ${singular} to get started.`)
          }
          icon={Icon ?? Search}
          title={filtered ? "No matches" : `No ${many} yet`}
        />
      ) : (
        <div className="aui-tablewrap">
          <table className="aui-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    data-align={column.align}
                    data-hide={column.hideSmall ? "sm" : undefined}
                    key={column.key}
                    scope="col"
                  >
                    {column.label}
                  </th>
                ))}
                <th data-align="right" scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row[idKey]}>
                  {columns.map((column) => (
                    <td
                      className={column.numeric ? "aui-table__num" : undefined}
                      data-align={column.align}
                      data-hide={column.hideSmall ? "sm" : undefined}
                      key={column.key}
                    >
                      {column.render ? (
                        column.render(row)
                      ) : column.status ? (
                        <Status tone={statusTone?.(row)} value={row[column.key] ?? "—"} />
                      ) : column.primary ? (
                        <span className="aui-table__primary">
                          <strong>{row[column.key] || "—"}</strong>
                          {column.sub && row[column.sub] && <small>{row[column.sub]}</small>}
                        </span>
                      ) : (
                        (row[column.key] ?? "—")
                      )}
                    </td>
                  ))}
                  <td data-align="right">
                    <span className="aui-rowacts">
                      {(() => {
                        const offered = rowAction?.(row);
                        if (!offered) return null;
                        const actions = Array.isArray(offered) ? offered : [offered];
                        return actions.map((action) => (
                          <IconBtn
                            danger={action.tone === "danger"}
                            disabled={action.disabled}
                            good={action.tone === "good"}
                            icon={action.icon}
                            key={action.label}
                            label={action.label}
                            onClick={() => apply(row, action)}
                          />
                        ));
                      })()}
                      {!readOnly && (
                        <IconBtn
                          icon={Pencil}
                          label={`Edit ${row[idKey]}`}
                          onClick={() => openDraft(row)}
                        />
                      )}
                      {!readOnly && (
                        <IconBtn
                          danger
                          icon={Trash2}
                          label={`Delete ${row[idKey]}`}
                          onClick={() => setDoomed(row)}
                        />
                      )}
                      {rowHref && (
                        <Link
                          aria-label={`Open ${row[idKey]}`}
                          className="aui-iconbtn"
                          href={rowHref(row)}
                          title={`Open ${row[idKey]}`}
                        >
                          <ArrowRight aria-hidden size={15} strokeWidth={1.7} />
                        </Link>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="aui-tablefoot">
            <span>
              Showing <strong>{visible.length}</strong> of <strong>{rows.length}</strong> {many}
            </span>
            {filtered && (
              <button
                className="aui-link"
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
                type="button"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      )}

      {/* One form, two verbs. Keyed on the record so switching rows without
          closing the dialog resets every field to the new record's values.

          The submit control sits in the modal's fixed footer while the fields
          scroll in its body, which HTML allows as long as the button names the
          form by id — the alternative is a form wrapped around a Radix content
          region, which breaks its focus management. */}
      <Modal
        footer={
          <>
            <Btn onClick={() => setDraft(undefined)}>Cancel</Btn>
            <Btn form="aui-record-form" type="submit" variant="solid">
              {editing ? "Save changes" : `Create ${singular}`}
            </Btn>
          </>
        }
        icon={Icon}
        onOpenChange={(next) => !next && setDraft(undefined)}
        open={draft !== undefined}
        size={fields.length > 5 ? "wide" : "md"}
        title={editing ? `Edit ${singular}` : `New ${singular}`}
        tone={tone}
        description={
          editing
            ? `Change what this ${singular} records. Nothing is saved until you apply it.`
            : `Fill in what this ${singular} needs. You can edit any of it later.`
        }
      >
        <form className="aui-form" id="aui-record-form" key={draft?.[idKey] ?? "new"} onSubmit={save}>
          <div className="aui-form aui-form--2">
            {fields.map((field) => {
              const choices = choicesOf(field, formValues, draft ?? undefined);
              return (
              <Field
                full={field.full || field.type === "textarea"}
                group={field.type === "chips"}
                help={field.help}
                hint={field.hint}
                key={field.key}
                label={field.label}
              >
                {field.type === "chips" ? (
                  <MultiChoice
                    defaultValue={draft?.[field.key] ?? field.initial ?? ""}
                    name={field.key}
                    options={choices.map(optionValue)}
                  />
                ) : field.type === "select" ? (
                  <Select
                    ariaLabel={field.label}
                    /* Remounted when its vocabulary changes. The dropdown clears
                       a controlled value whose option has just unmounted, and
                       reports the clear as a change — which would undo the
                       answer the reconcile above had only just chosen for it.
                       Starting fresh on the new list sidesteps that entirely. */
                    key={field.optionsFor ? choices.map(optionValue).join("|") : undefined}
                    name={field.key}
                    options={choices}
                    required={field.required}
                    /* Driven only where something reads it. A register with no
                       dependent field keeps the uncontrolled select it has
                       always had, and behaves identically. */
                    {...(dependent
                      ? { value: formValues[field.key] ?? "", onValueChange: (next: string) => update(field.key, next) }
                      : {
                          defaultValue:
                            draft?.[field.key] ??
                            field.initial ??
                            (choices[0] === undefined ? "" : optionValue(choices[0])),
                        })}
                  />
                ) : field.type === "textarea" ? (
                  <textarea
                    defaultValue={draft?.[field.key] ?? field.initial ?? ""}
                    name={field.key}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                ) : (
                  <input
                    defaultValue={draft?.[field.key] ?? field.initial ?? ""}
                    inputMode={field.type === "number" ? "numeric" : undefined}
                    min={field.type === "number" ? (field.min ?? "0") : undefined}
                    name={field.key}
                    placeholder={field.placeholder}
                    required={field.required}
                    onChange={
                      dependent ? (event) => update(field.key, event.target.value) : undefined
                    }
                    step={field.type === "number" ? field.step : undefined}
                    type={field.type === "number" ? "number" : (field.type ?? "text")}
                  />
                )}
              </Field>
              );
            })}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        confirmLabel={`Delete ${singular}`}
        description={`${doomed?.[idKey] ?? "This record"} will be removed from the register. You can undo this from the toast that follows.`}
        onConfirm={() => doomed && remove(doomed)}
        onOpenChange={(next) => !next && setDoomed(undefined)}
        open={doomed !== undefined}
        title={`Delete this ${singular}?`}
      />
    </>
  );
}

/**
 * The `chips` field. Every option is on screen as a toggle, so picking four
 * sizes is four clicks with nothing hidden behind a menu, and the result is
 * handed to the surrounding form through one hidden input — which is what lets
 * `FormData(form)` keep working the same way it does for every other field.
 */
function MultiChoice({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: string[];
  defaultValue: string;
}) {
  const [chosen, setChosen] = useState(() => splitList(defaultValue));

  /* What is picked AND still on offer. When the field this one hangs off
     changes — a garment turning from a top into a bottom — the letter sizes
     stop being options, so they stop counting as answers. Derived at render
     rather than reconciled in an effect, so the hidden input can never submit
     a size the item does not come in. Picks that fall out this way are kept in
     state, so flipping back restores them instead of losing the work. */
  const live = options.filter((option) => chosen.includes(option));

  function toggle(option: string) {
    setChosen((current) => {
      /* Picks belonging to a vocabulary that is not on screen right now. They
         are carried untouched rather than dropped, which is what makes
         flipping back a restore instead of a retype. */
      const stashed = current.filter((entry) => !options.includes(entry));
      const held = options.filter((entry) => current.includes(entry));
      const next = held.includes(option)
        ? held.filter((entry) => entry !== option)
        : /* Kept in the order the options were declared, not the order they
             were clicked, so "S, M, L" never comes back as "L, S, M". */
          options.filter((entry) => entry === option || held.includes(entry));
      return [...stashed, ...next];
    });
  }

  return (
    <span className="aui-chips aui-chips--field">
      {options.map((option) => (
        <button
          aria-pressed={live.includes(option) ? "true" : "false"}
          className="aui-chip"
          key={option}
          onClick={() => toggle(option)}
          type="button"
        >
          {option}
        </button>
      ))}
      <input name={name} type="hidden" value={live.join(", ")} />
    </span>
  );
}

/** A comma-joined field back into its parts, ignoring stray spacing. */
function splitList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sentence(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The most human thing in the record, for a toast line.
 *
 * A name first, wherever the record has one — including a record whose name
 * was derived rather than typed, which the fields alone would miss and answer
 * with the first text box instead. A product listed from stock has no name
 * field, and "Product created · ₹11,200" names the wrong thing.
 */
function label(values: RecordRow, fields: FormField[], fallback: string) {
  if (values.name) return values.name;
  const first = fields.find((field) => field.type !== "select" && values[field.key]);
  return first ? values[first.key] : fallback;
}
