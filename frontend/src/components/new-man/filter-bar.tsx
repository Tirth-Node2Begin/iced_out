"use client";

import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  CATEGORIES,
  SORTS,
  type Category,
  type SortValue,
} from "@/components/new-man/data";
import { EASE_OUT } from "@/components/new-home/motion-primitives";

/**
 * The filter bar — one horizontal rail that sits in normal flow between the
 * section head and the grid, and stays there.
 *
 * A bar rather than the vertical rail /new-drop uses: this page keeps the
 * full-bleed hero and editorial above it, so a column pinned beside the grid
 * would have nothing to align to.
 *
 * Deliberately not pinned — neither sticky nor fixed. It scrolls off with the
 * edit like any other block, so there is nothing here to observe and nothing in
 * CSS that has to track the header's height.
 *
 * Every control states its own semantics: the categories are a radiogroup, the
 * two availability filters are checkboxes, and sort is a listbox. The active
 * category marker is a single `layoutId` element Motion moves between chips,
 * so switching reads as the marker travelling rather than two fills trading
 * places.
 */
export function FilterBar({
  category,
  onCategory,
  sort,
  onSort,
  inStockOnly,
  onInStockOnly,
  newOnly,
  onNewOnly,
  onReset,
  total,
  shown,
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
  total: number;
  shown: number;
}) {
  const dirty =
    category !== "all" || sort !== "featured" || inStockOnly || newOnly;

  return (
    <div aria-label="Filter the men's edit" className="nh-filter" role="region">
      <div className="nh-filter__group nh-filter__group--cats">
        <span aria-hidden className="nh-filter__icon">
          <SlidersHorizontal size={12} />
        </span>
        <div
          aria-label="Filter by category"
          className="nh-filter__chips"
          role="radiogroup"
        >
          {CATEGORIES.map((item) => {
            const active = category === item.value;
            return (
              <button
                aria-checked={active}
                className="nh-chip"
                key={item.value}
                onClick={() => onCategory(item.value)}
                role="radio"
                type="button"
              >
                {active && (
                  <motion.span
                    aria-hidden
                    className="nh-chip__bg"
                    layoutId="nh-man-category"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 38,
                      mass: 0.9,
                    }}
                  />
                )}
                <span className="nh-chip__label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* This rule is the one that turns horizontal when the bar stacks, so
            the chips keep a row of their own. The controls travel together in
            their own flex row — which is also what lets them wrap on a phone
            without the column-direction parent trying to wrap into columns. */}
      <span aria-hidden className="nh-filter__rule" />

      <div className="nh-filter__controls">
        <div className="nh-filter__group nh-filter__group--toggles">
          <CheckChip
            checked={inStockOnly}
            label="In stock"
            onChange={() => onInStockOnly(!inStockOnly)}
          />
          <CheckChip
            checked={newOnly}
            label="New in"
            onChange={() => onNewOnly(!newOnly)}
          />
        </div>

        <span aria-hidden className="nh-filter__rule nh-filter__rule--v" />

        <div className="nh-filter__group">
          <SortMenu onChange={onSort} value={sort} />
        </div>

        <span aria-hidden className="nh-filter__rule nh-filter__rule--v" />

        <div className="nh-filter__group nh-filter__group--meta">
          {/* the live count is what tells a shopper a filter did anything at
                all; keying it on the number lets the digits swap rather than
                silently rewrite themselves */}
          <p aria-live="polite" className="nh-filter__count">
            <span className="nh-filter__countBox">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.b
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={shown}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                >
                  {String(shown).padStart(2, "0")}
                </motion.b>
              </AnimatePresence>
            </span>
            <span className="nh-filter__countTail">
              / {String(total).padStart(2, "0")} pieces
            </span>
          </p>

          <AnimatePresence initial={false}>
            {dirty && (
              <motion.button
                animate={{ opacity: 1, width: "auto" }}
                className="nh-filter__reset"
                exit={{ opacity: 0, width: 0 }}
                initial={{ opacity: 0, width: 0 }}
                onClick={onReset}
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
    </div>
  );
}

/**
 * Sort, as a listbox rather than a native <select>.
 *
 * The native control cannot be styled past its border: the popup is drawn by
 * the OS in the OS's own colours, which on a page this dark reads as a system
 * dialog dropped onto the design. This renders inline — inside `.nh-root`, so
 * it inherits the same tokens as everything else — and keeps the parts that
 * matter: Escape and an outside click close it, the trigger reports its state,
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
    <div className="nh-sort" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Sort products — ${active.label}`}
        className="nh-sort__trigger"
        onClick={() => setOpen((state) => !state)}
        type="button"
      >
        <span className="nh-sort__lead">Sort</span>
        <span className="nh-sort__value">{active.label}</span>
        <ChevronDown
          aria-hidden
          className="nh-sort__caret"
          data-open={open}
          size={12}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-label="Sort products"
            className="nh-sort__menu"
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            role="listbox"
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            {SORTS.map((option) => (
              <button
                aria-selected={option.value === value}
                className="nh-sort__option"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check aria-hidden size={12} strokeWidth={2.8} />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A checkbox drawn as a chip, so it sits in the same register as the categories. */
function CheckChip({
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
      className="nh-chip nh-chip--check"
      data-on={checked}
      onClick={onChange}
      role="checkbox"
      type="button"
    >
      <span aria-hidden className="nh-chip__box">
        {checked && <Check size={9} strokeWidth={3.4} />}
      </span>
      <span className="nh-chip__label">{label}</span>
    </button>
  );
}
