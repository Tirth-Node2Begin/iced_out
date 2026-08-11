"use client";

import { Check, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import {
  CATEGORIES,
  SORTS,
  type Category,
  type SortValue,
} from "@/components/gender/data";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * The filter rail — a sticky column pinned to the left of the edit.
 *
 * It sits in column one of `.gx-edit` and spans every row, so `position:
 * sticky` alone keeps it beside the grids for exactly as long as the edit
 * runs and releases it at the end. No scroll listener, no fixed positioning,
 * nothing to switch off when the region leaves the viewport.
 *
 * Every control is laid out rather than hidden behind a dropdown: category,
 * availability, and sort are all readable at a glance, which is the point of
 * giving them a column of their own.
 *
 * shadcn's `ToggleGroup` carries the roving-focus and single-selection
 * semantics; the look is entirely ours. The active marker is one `layoutId`
 * element that Motion moves between rows, so changing category reads as the
 * marker travelling rather than two backgrounds trading places.
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
  const dirty = category !== "all" || sort !== "featured" || inStockOnly || newOnly;

  return (
    <aside aria-label="Filter the edit" className="gx-rail" id="gx-edit">
      <div className="gx-rail__panel">
        <div className="gx-rail__head">
          <p className="gx-rail__count">
            <b>{String(shown).padStart(2, "0")}</b>
            <span>/ {String(total).padStart(2, "0")} pieces</span>
          </p>
          {dirty && (
            <button className="gx-rail__reset" onClick={onReset} type="button">
              <RotateCcw aria-hidden size={11} />
              Clear
            </button>
          )}
        </div>

        <div className="gx-rail__group">
          <span className="gx-rail__label">Category</span>
          <ToggleGroup
            aria-label="Filter by category"
            className="gx-rail__list"
            onValueChange={(value) => {
              // Radix emits "" when the active item is pressed again; the
              // listing always has to show something, so that falls back to All.
              onCategory((value as Category | "all") || "all");
            }}
            orientation="vertical"
            type="single"
            value={category}
          >
            {CATEGORIES.map((item) => (
              <ToggleGroupItem className="gx-rail__row" key={item.value} value={item.value}>
                {category === item.value && (
                  <motion.span
                    aria-hidden
                    className="gx-rail__rowBg"
                    layoutId="gx-cat-marker"
                    transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                  />
                )}
                <span className="gx-rail__rowLabel">{item.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="gx-rail__group">
          <span className="gx-rail__label">Availability</span>
          <div className="gx-rail__list">
            <Check2
              checked={inStockOnly}
              label="In stock only"
              onChange={() => onInStockOnly(!inStockOnly)}
            />
            <Check2 checked={newOnly} label="New in" onChange={() => onNewOnly(!newOnly)} />
          </div>
        </div>

        <div className="gx-rail__group">
          <span className="gx-rail__label">Sort</span>
          <div className="gx-rail__list" role="radiogroup" aria-label="Sort products">
            {SORTS.map((option) => (
              <button
                aria-checked={sort === option.value}
                className="gx-rail__row"
                key={option.value}
                onClick={() => onSort(option.value)}
                role="radio"
                type="button"
              >
                {sort === option.value && (
                  <motion.span
                    aria-hidden
                    className="gx-rail__rowBg"
                    layoutId="gx-sort-marker"
                    transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                  />
                )}
                <span className="gx-rail__rowLabel">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** A checkbox drawn as a row, to match the two radio groups either side. */
function Check2({
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
      className="gx-rail__row gx-rail__row--check"
      onClick={onChange}
      role="checkbox"
      type="button"
    >
      <span aria-hidden className="gx-rail__box">
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="gx-rail__rowLabel">{label}</span>
    </button>
  );
}
