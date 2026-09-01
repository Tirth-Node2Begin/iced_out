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
} from "@/components/shell/admin-ui";
import { MediaField } from "@/components/shell/media-field";
import { MediaGalleryField } from "@/components/shell/media-gallery-field";
import { Toolbar } from "@/components/shell/toolbar";

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
  /**
   * `image` is a picker, not an input: it uploads the chosen file to the media
   * endpoint straight away and keeps what came back — the asset's URL — as its
   * value. The record therefore stays the flat string map everything else here
   * relies on, and the bytes are already stored and validated by the time the
   * form is submitted.
   *
   * `gallery` is its many-valued cousin — the other photographs of the same
   * thing, submitted as one comma-joined list of URLs in display order.
   *
   * `checkbox` is a single yes/no, and it submits `"true"` or `""` rather than
   * the browser's `"on"`, so a register reading the value back gets the same
   * string whichever way it was set.
   */
  type?:
    | "text"
    | "number"
    | "select"
    | "textarea"
    | "date"
    | "chips"
    | "image"
    | "gallery"
    | "checkbox"
    /* Passed straight through to the input, which is what earns them their
       place: `email` and `tel` change the keyboard a phone offers and hand the
       browser its own validation, and neither needs a line of code here to do
       it — see the `type=` on the input below. */
    | "email"
    | "tel";
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
  /**
   * Asked when the record is created and never again.
   *
   * For a field that is a DECISION rather than a fact — "publish this now". The
   * decision is made once; offering it on every later edit turns a correction to
   * a typo into a chance to re-run it by accident. It is dropped from the edit
   * form entirely rather than disabled, because a control that is present and
   * inert still reads as an option.
   */
  createOnly?: boolean;
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
  /** What the record becomes. Undo comes free with it on a local register. */
  patch?: RecordRow;
  /**
   * For a verb whose consequences reach past this row — cancelling an order
   * also cancels the parcel carrying it — the register hands the change to the
   * store that owns both instead of writing the row itself. No undo is offered
   * for one of these, because this component cannot know how to reverse it.
   *
   * May return a promise: a verb backed by its own endpoint (confirm an order,
   * approve a return) is awaited, and a refusal is reported as a toast.
   */
  onSelect?: () => void | Promise<void>;
  tone?: "good" | "danger";
  /**
   * A `danger` verb asks before it fires. Pass `false` for one that is genuinely
   * cheap to undo — nothing does yet, which is why it defaults to asking.
   */
  confirm?: false;
  /** What agreeing to it actually costs, in the screen's own words. */
  confirmCopy?: string;
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
   * The three write verbs, sent to the SERVER.
   *
   * Pass these — see `useRegister` — and this component stops being the owner of
   * the records: the form awaits the request, a refusal keeps the dialog open
   * with the server's reason on it, and the rows redraw from whatever the
   * database ends up holding. That is the difference between a console that
   * looks like it saved and one that did.
   *
   * `onCommit` is still used for the local-only registers that have not been
   * given endpoints yet, so both arrangements can coexist while screens are
   * moved across one at a time.
   *
   * Undo is deliberately NOT offered for a persisted change. A toast offering to
   * reverse something already written to the database, which may have cascaded,
   * is a promise this component cannot keep.
   */
  onCreate?: (values: RecordRow) => Promise<void>;
  onUpdate?: (values: RecordRow, previous: RecordRow) => Promise<void>;
  onDelete?: (row: RecordRow) => Promise<void>;
  /** True while the register's first read is in flight. */
  loading?: boolean;
  /** How the last read failed, as a sentence to show above the table. */
  error?: string | null;
  /** False until the endpoint has answered — an empty register vs an unread one. */
  loaded?: boolean;
  /**
   * Fills in what the form deliberately does not ask for — a slug minted from
   * a name, a stock code. Runs on create and on edit; `previous` is the record
   * being edited, and is undefined on a create.
   */
  derive?: (values: RecordRow, rows: RecordRow[], previous?: RecordRow) => RecordRow;
  /**
   * Answers the REST of the form from the one field that was just changed.
   *
   * `derive` cannot do this: it runs at submit, on values nobody can still see.
   * A listing chosen from a stock item should arrive with that item's price and
   * photographs already in the boxes, so the operator confirms them instead of
   * copying them off another screen — and can still edit any of it before saving.
   *
   * `changed` is the field that was just answered, or `null` when the form has
   * only just opened — which matters, because the driving field starts on the
   * first option it is offered rather than on nothing, and a form that filled
   * itself in only after the operator re-picked what was already selected would
   * be a form that looked broken the first time.
   *
   * Return only the keys to fill in, or null to leave the form alone. It decides
   * for itself whether `changed` is a field it cares about. Fields it writes to
   * are remounted around the new value, which is why it should not answer a
   * field the operator is currently typing in.
   */
  autofill?: (changed: string | null, values: RecordRow, previous?: RecordRow) => RecordRow | null;
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
  onCreate,
  onUpdate,
  onDelete,
  loading,
  error,
  loaded,
  derive,
  autofill,
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
  /* A destructive row verb waiting to be agreed to. Every `tone: "danger"`
     action lands here first — see the note on `RowAction.confirm`. */
  const [risky, setRisky] = useState<{ row: RecordRow; action: RowAction } | undefined>(undefined);

  /**
   * What the open form is currently holding.
   *
   * Only kept for a form that has a field reading the others — everywhere else
   * the inputs stay uncontrolled and `FormData` at submit is the only time
   * anyone asks what they say, which is the cheaper arrangement and the one
   * eighty screens already rely on.
   */
  const dependent = fields.some((field) => field.optionsFor) || Boolean(autofill);
  const [formValues, setFormValues] = useState<RecordRow>({});

  /**
   * Bumped whenever `autofill` writes a value, and mixed into every field's key.
   *
   * The inputs in this form are uncontrolled — `FormData` at submit is the only
   * time anything asks what they say, which is the arrangement eighty screens
   * already rely on. An uncontrolled input ignores a change to its
   * `defaultValue`, so the only honest way to put an answer INTO one is to give
   * it a new identity and let it mount around the new value.
   */
  const [revision, setRevision] = useState(0);

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
    const values = seed(record);

    /* An edit opens on what the record actually says — its own answers are the
       truth, and filling them in from somewhere else would silently rewrite a
       product whose price was deliberately set apart from its stock item's. A
       CREATE has no answers yet, so the field it starts on gets to supply them. */
    if (!record) Object.assign(values, autofill?.(null, values, undefined) ?? {});

    setDraft(record);
    setFormValues(values);
    /* A fresh dialog is a fresh set of fields whatever the counter says — the
       key changes with it, so the boxes cannot carry over the last record's
       answers. */
    setRevision((current) => current + 1);
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

      /* Then the answers this change IMPLIES — a listing taking on the price and
         the photographs of the stock item it was just pointed at. Applied after
         the reconcile above so it cannot be undone by it, and only the keys that
         actually move are counted, so a change that fills nothing in does not
         tear the form down around the operator. */
      const filled = autofill?.(key, next, record) ?? null;

      if (filled) {
        let moved = false;

        for (const [target, value] of Object.entries(filled)) {
          if (target === key || (next[target] ?? "") === value) continue;
          next[target] = value;
          moved = true;
        }

        if (moved) setRevision((current) => current + 1);
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
   * Which verbs this register actually offers.
   *
   * A persisted register — one given any of the three handlers — offers exactly
   * the verbs it was given a handler for. That is how a register can be
   * create-only (a courier pickup is started and handed over; there is nothing to
   * edit about it and no endpoint to delete one) without needing a prop per verb.
   *
   * A local register keeps the old behaviour: `readOnly` off means all three,
   * because it owns its own rows and can always do all of them.
   */
  const persisted = Boolean(onCreate ?? onUpdate ?? onDelete);
  const canCreate = !readOnly && (persisted ? Boolean(onCreate) : true);
  const canEdit = !readOnly && (persisted ? Boolean(onUpdate) : true);
  const canDelete = !readOnly && (persisted ? Boolean(onDelete) : true);

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
  async function apply(row: RecordRow, action: RowAction) {
    if (action.onSelect) {
      /* A verb the page owns. It may be async — approving a return posts to the
         API — so it is awaited, and its refusal is reported rather than lost to
         an unhandled rejection. */
      try {
        await action.onSelect();
      } catch (caught) {
        toast.error(`${action.label} failed`, {
          description:
            caught instanceof Error ? caught.message : "The server refused that change.",
        });
        return;
      }

      if (action.toast) toast.success(action.toast.title, { description: action.toast.description });
      return;
    }

    const patch = action.patch ?? {};

    /* A persisted register sends the patch to the server and re-reads. No undo
       for the same reason a delete has none: the change is written, and it may
       have cascaded past this row. */
    if (onUpdate) {
      try {
        await onUpdate({ ...row, ...patch }, row);
        if (action.toast) {
          toast.success(action.toast.title, { description: action.toast.description });
        }
      } catch (caught) {
        toast.error(`${action.label} failed`, {
          description:
            caught instanceof Error ? caught.message : "The server refused that change.",
        });
      }

      return;
    }

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

  /**
   * True while a persisted create or edit is in flight.
   *
   * The submit button is held for the duration, which is not politeness: without
   * it a double-click on a slow connection posts the form twice, and two
   * products get created from one dialog.
   */
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typed: RecordRow = {};

    for (const field of fields) {
      /* A checkbox the browser did not send is not missing data — it is the
         answer "no", and it has to reach the register as one rather than as an
         empty string that could equally mean "never asked". */
      typed[field.key] =
        field.type === "checkbox"
          ? form.get(field.key) === null
            ? ""
            : "true"
          : String(form.get(field.key) ?? "").trim();
    }

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

    /* Persisted register: the server has the last word on whether this record may
       exist, so the dialog stays open until it answers. A refusal — a duplicate
       slug, a size with no stock left, a status this operator may not set — is
       shown against the form the operator can still fix, rather than being
       swallowed after the row has already been drawn as saved. */
    const persist = previous ? onUpdate : onCreate;

    if (persist) {
      setSaving(true);

      try {
        await (previous ? onUpdate!(values, previous) : onCreate!(values));

        toast.success(`${sentence(singular)} ${previous ? "updated" : "created"}`, {
          description: label(values, fields, previous?.[idKey] ?? ""),
        });
        setDraft(undefined);
      } catch (caught) {
        /* The API client's normaliser has already turned this into a sentence
           written to be read by an operator. */
        toast.error(`This ${singular} could not be ${previous ? "saved" : "created"}`, {
          description:
            caught instanceof Error ? caught.message : "The server refused that change.",
        });
      } finally {
        setSaving(false);
      }

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

  async function remove(row: RecordRow) {
    if (onDelete) {
      setDeleting(true);

      try {
        await onDelete(row);
        /* No undo. The record is gone from the database and the delete may have
           cascaded; offering to put it back would be a promise this component
           cannot keep. */
        toast.success(`${sentence(singular)} deleted`, {
          description: `${row[idKey]} was removed.`,
        });
      } catch (caught) {
        toast.error(`${row[idKey]} could not be deleted`, {
          description:
            caught instanceof Error ? caught.message : "The server refused that change.",
        });
      } finally {
        setDeleting(false);
      }

      return;
    }

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
      <Toolbar
        actions={
          <>
            {/* A screen's own extra control joins the verbs rather than
                competing with the search field for the middle of the row. */}
            {toolbarExtra}

            <Btn onClick={exportCsv} size="sm">
              <Download aria-hidden size={14} strokeWidth={1.7} /> Export
            </Btn>

            {canCreate && (
              <Btn onClick={() => openDraft(null)} size="sm" variant="solid">
                <Plus aria-hidden size={14} strokeWidth={2} /> New {singular}
              </Btn>
            )}
          </>
        }
        chips={filtersBelow ? undefined : chips}
        lead={toolbarLead}
        search={
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
        }
      />

      {filtersBelow && chips && <div className="aui-filterbar">{chips}</div>}

      {children}

      {/* A register that failed to load says so, above whatever it managed to
          hold. Rendering the empty state for a failed read is how a console
          tells an operator the shop has no orders when in fact the request
          fell over. */}
      {error && (
        <p className="aui-tablefoot" role="status">
          <span>{error}</span>
        </p>
      )}

      {visible.length === 0 ? (
        /* Three different nothings. "Loading" is not "empty", and neither is
           "your filter excluded everything" — offering "Add the first product"
           while the first read is still in flight invites an operator to create
           a duplicate of something they cannot see yet. */
        loading && !loaded ? (
          <Empty
            copy={`Reading ${many} from the database…`}
            icon={Icon ?? Search}
            title={`Loading ${many}`}
          />
        ) : (
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
              ) : !canCreate || error ? undefined : (
                <Btn onClick={() => openDraft(null)} variant="solid">
                  <Plus aria-hidden size={14} strokeWidth={2} /> New {singular}
                </Btn>
              )
            }
            copy={
              filtered
                ? `Nothing in ${many} matches that search. Clear the filters to see the whole register.`
                : error
                  ? `This register could not be read, so there is nothing to show. ${error}`
                  : (emptyHint ?? `Nothing here yet. Add the first ${singular} to get started.`)
            }
            icon={Icon ?? Search}
            title={filtered ? "No matches" : error ? `${sentence(many)} unavailable` : `No ${many} yet`}
          />
        )
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
                            onClick={() =>
                              /* Danger asks first. Cancelling an order reaches
                                 the parcel and the stock behind it, rejecting a
                                 return closes it for the customer — none of the
                                 five verbs wearing this tone can be taken back
                                 from the row that fired it, and the button that
                                 fires it is 32px wide and beside its opposite. */
                              action.tone === "danger" && action.confirm !== false
                                ? setRisky({ row, action })
                                : void apply(row, action)
                            }
                          />
                        ));
                      })()}
                      {canEdit && (
                        <IconBtn
                          icon={Pencil}
                          label={`Edit ${row[idKey]}`}
                          onClick={() => openDraft(row)}
                        />
                      )}
                      {canDelete && (
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
            <Btn disabled={saving} onClick={() => setDraft(undefined)}>
              Cancel
            </Btn>
            {/* Held while the request is out. Without this a double-click on a
                slow connection posts the form twice and creates two records. */}
            <Btn disabled={saving} form="aui-record-form" type="submit" variant="solid">
              {saving ? "Saving…" : editing ? "Save changes" : `Create ${singular}`}
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
        <form
          className="aui-form"
          id="aui-record-form"
          key={draft?.[idKey] ?? "new"}
          onSubmit={(event) => void save(event)}
        >
          <div className="aui-form aui-form--2">
            {/* `fields` itself is untouched: `seed`, `update` and `save` all read
                the whole declaration, and a create-only field simply resolves to
                an empty answer on an edit. Only what is DRAWN is narrowed. */}
            {(editing ? fields.filter((field) => !field.createOnly) : fields).map((field) => {
              const choices = choicesOf(field, formValues, draft ?? undefined);
              /* What an uncontrolled control starts from. In a form nothing
                 reads across, that is the record being edited; in one where a
                 field can be answered FOR the operator it is whatever the form
                 currently holds, and the key below is what makes a control pick
                 that up after `autofill` has moved it. */
              const start = dependent
                ? (formValues[field.key] ?? "")
                : (draft?.[field.key] ?? field.initial ?? "");
              const key = dependent ? `${field.key}#${revision}` : field.key;

              /* A checkbox answers for itself. `Field` renders its caption as a
                 `<label>`, and a checkbox needs its own label beside the box —
                 wrapping one in the other would nest two labels, which is
                 invalid and leaves the browser deciding which one the click
                 belongs to. So this one stands outside the wrapper and says its
                 piece once. */
              if (field.type === "checkbox") {
                return (
                  <div className="aui-field aui-field--full" key={key}>
                    <CheckBox
                      defaultChecked={start === "true"}
                      hint={field.help}
                      label={field.label}
                      name={field.key}
                      onToggle={
                        dependent ? (on) => update(field.key, on ? "true" : "") : undefined
                      }
                    />
                  </div>
                );
              }

              return (
              <Field
                full={field.full || field.type === "textarea" || field.type === "gallery"}
                group={field.type === "chips" || field.type === "gallery"}
                help={field.help}
                hint={field.hint}
                key={key}
                label={field.label}
              >
                {field.type === "chips" ? (
                  <MultiChoice
                    defaultValue={start}
                    name={field.key}
                    options={choices.map(optionValue)}
                  />
                ) : field.type === "gallery" ? (
                  <MediaGalleryField defaultValue={start} label={field.label} name={field.key} />
                ) : field.type === "image" ? (
                  <MediaField defaultValue={start} label={field.label} name={field.key} />
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
                    defaultValue={start}
                    name={field.key}
                    onChange={
                      dependent ? (event) => update(field.key, event.target.value) : undefined
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                ) : (
                  <input
                    defaultValue={start}
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
        confirmLabel={deleting ? "Deleting…" : `Delete ${singular}`}
        /* Two different promises, and only one of them can be kept. A local
           register can put the row back; a persisted one has written the delete
           to the database and may have cascaded past this record. */
        description={
          onDelete
            ? `${doomed?.[idKey] ?? "This record"} will be deleted from the database. This cannot be undone.`
            : `${doomed?.[idKey] ?? "This record"} will be removed from the register. You can undo this from the toast that follows.`
        }
        onConfirm={() => doomed && void remove(doomed)}
        onOpenChange={(next) => !next && setDoomed(undefined)}
        open={doomed !== undefined}
        title={`Delete this ${singular}?`}
      />

      {/* The action's own label is the title AND the confirming button, so the
          thing you are agreeing to is spelled out twice and never abbreviated
          to "OK". The dismissing button says "Go back" rather than "Cancel" —
          on the order register the verb itself IS "Cancel", and two buttons
          reading Cancel is the worst possible pair to put under that question. */}
      <ConfirmDialog
        confirmLabel={risky?.action.label ?? "Continue"}
        description={
          risky?.action.confirmCopy ??
          "This cannot be undone from here, and it may reach records beyond this row."
        }
        onConfirm={() => risky && void apply(risky.row, risky.action)}
        onOpenChange={(next) => !next && setRisky(undefined)}
        open={risky !== undefined}
        title={risky ? `${risky.action.label}?` : ""}
      />
    </>
  );
}

/**
 * The `checkbox` field.
 *
 * A real `<input type="checkbox">` rather than a styled button, so the label,
 * the space bar and every assistive technology behave the way they already know
 * how to. Its `value` is fixed at `"true"` and the browser omits it entirely
 * when it is off, which is exactly the shape `save()` reads it back with.
 */
function CheckBox({
  name,
  label,
  hint,
  defaultChecked,
  onToggle,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
  /** Only in a form something reads across — see `dependent`. */
  onToggle?: (checked: boolean) => void;
}) {
  return (
    <label className="aui-check">
      <input
        defaultChecked={defaultChecked}
        name={name}
        onChange={onToggle ? (event) => onToggle(event.target.checked) : undefined}
        type="checkbox"
        value="true"
      />
      <span className="aui-check__box" aria-hidden />
      <span className="aui-check__copy">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
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
