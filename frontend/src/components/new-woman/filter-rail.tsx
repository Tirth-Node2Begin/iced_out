"use client";

import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  CATEGORIES,
  SORTS,
  type Category,
  type SortValue,
} from "@/components/gender/data";
import { EASE_OUT } from "@/components/new-home/motion-primitives";

/**
 * The women's filter rail.
 *
 * A rule, not a capsule. The men's bar is a frosted plate that floats above the
 * grid; this is the line the grid hangs from — the categories read as tabs
 * along it, the two availability filters and sort sit at its end, and the only
 * fill on the whole control is the mark under the live category.
 *
 * Every control states its own semantics: the categories are a radiogroup, the
 * two filters are checkboxes, and sort is a listbox. The mark is one element
 * that Motion moves between tabs, so switching reads as it travelling rather
 * than two rules trading places.
 *
 * The state itself lives on the section above (see `edit.tsx`), which is what
 * keeps this presentational and lets the empty state's "clear" share one reset
 * with the one here.
 */
export function FilterRail({
  category,
  onCategory,
  sort,
  onSort,
  inStockOnly,
  onInStockOnly,
  newOnly,
  onNewOnly,
  onReset,
}: {
  category: Category | "all";
  onCategory: (value: Category | "all") => void;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  inStockOnly: boolean;
  onInStockOnly: (value: boolean) => void;
  newOnly: boolean;
  onNewOnly: (value: boolean) => void;
  onReset: () => void;
}) {
  const dirty =
    category !== "all" || sort !== "featured" || inStockOnly || newOnly;

  return (
    <div aria-label="Filter the women's edit" className="nw-rail" role="region">
      <div aria-label="Filter by category" className="nw-rail__tabs" role="radiogroup">
        {CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <button
              aria-checked={active}
              className="nw-tab"
              data-on={active ? "" : undefined}
              key={item.value}
              onClick={() => onCategory(item.value)}
              role="radio"
              type="button"
            >
              {item.label}
              {active && (
                <motion.span
                  aria-hidden
                  className="nw-tab__mark"
                  layoutId="nw-category-mark"
                  transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.7 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="nw-rail__tools">
        <Toggle checked={inStockOnly} label="In stock" onChange={() => onInStockOnly(!inStockOnly)} />
        <Toggle checked={newOnly} label="New in" onChange={() => onNewOnly(!newOnly)} />

        <SortMenu onChange={onSort} value={sort} />

        {/* Only once there is something to clear. Width is animated rather
            than display, so the tools beside it slide rather than jump. */}
        <AnimatePresence initial={false}>
          {dirty && (
            <motion.button
              animate={{ opacity: 1, width: "auto" }}
              className="nw-toggle"
              exit={{ opacity: 0, width: 0 }}
              initial={{ opacity: 0, width: 0 }}
              onClick={onReset}
              style={{ overflow: "hidden" }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              type="button"
            >
              <RotateCcw aria-hidden size={11} />
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A checkbox drawn at the weight of the rail it sits on. */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className="nw-toggle"
      onClick={onChange}
      role="checkbox"
      type="button"
    >
      <span aria-hidden className="nw-toggle__box">
        {checked && <Check size={9} strokeWidth={3.6} />}
      </span>
      {label}
    </button>
  );
}

/**
 * Sort, as a listbox rather than a native `<select>`.
 *
 * The native control cannot be styled past its border — the popup is drawn by
 * the OS in the OS's own colours, which on a page this dark reads as a system
 * dialog dropped onto the design. This renders inline, inside `.nw-root`, so it
 * inherits the same tokens as everything around it, and keeps the parts that
 * matter: Escape and an outside press close it, the trigger reports its state,
 * and the options are real options.
 */
function SortMenu({
  value,
  onChange,
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = SORTS.find((option) => option.value === value) ?? SORTS[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="nw-sort" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Sort pieces — ${active.label}`}
        className="nw-sort__button"
        onClick={() => setOpen((state) => !state)}
        type="button"
      >
        <span className="nw-sort__label">Sort</span>
        {active.label}
        <span aria-hidden className="nw-sort__chevron">
          <ChevronDown size={12} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-label="Sort pieces"
            className="nw-sort__menu"
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            role="listbox"
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            {SORTS.map((option) => (
              <li key={option.value} role="presentation">
                <button
                  aria-selected={option.value === value}
                  className="nw-sort__option"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  {option.label}
                  {option.value === value && (
                    <Check aria-hidden className="nw-sort__tick" size={12} strokeWidth={2.8} />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
