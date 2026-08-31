"use client";

import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The console's date range control.
 *
 * A two-month `react-day-picker` calendar in a popover, wearing the console's
 * palette rather than the shadcn neutral one — the calendar is portalled to
 * `<body>`, outside `.aui-app`, so `.aui-datepop` re-declares the tokens on
 * the floating surface the same way the modal and drawer surfaces do.
 *
 * Two things it will not do:
 *
 *   1. Resize. The trigger holds one width whatever it is showing, and the
 *      calendar floats in a portal, so opening the picker or switching from a
 *      single day to a three-month span never moves the header around it.
 *   2. Guess a date on the server. This app is statically exported, so the
 *      build's idea of "today" is stale by the next morning. Nothing renders a
 *      real date until `useHydrated()` says the browser is driving.
 */

/** One day reads as one date; a span reads as both ends. */
function label(range: DateRange | undefined): string | null {
  if (!range?.from) return null;
  const from = format(range.from, "d MMM yyyy");
  if (!range.to || range.to.getTime() === range.from.getTime()) return from;
  return `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`;
}

export function DateRangePicker({
  value,
  onChange,
  fallback,
  earliest,
  latest,
  open,
  onOpenChange,
}: {
  value: DateRange | undefined;
  onChange: (next: DateRange | undefined) => void;
  /** Shown until the browser takes over and a real date can be printed. */
  fallback: string;
  earliest?: Date;
  latest?: Date;
  /** Optional, for a caller that also opens the calendar from its own control. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const hydrated = useHydrated();
  const shown = hydrated ? (label(value) ?? fallback) : fallback;

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger aria-label="Change the date range" className="aui-daterange">
        <CalendarDays aria-hidden size={14} strokeWidth={1.7} />
        <b>{shown}</b>
        <ChevronDown aria-hidden data-open={open ? "true" : undefined} size={14} strokeWidth={1.8} />
      </PopoverTrigger>

      {/* `w-auto` is not decoration: the shadcn content box is a fixed `w-72`,
          which clips the second month clean off a range calendar. Passing a
          width utility is what lets tailwind-merge drop it. */}
      <PopoverContent align="end" className="aui-datepop w-auto" sideOffset={10}>
        {/* Mounted only while open: the calendar reads the clock to decide
            which month to show, which is the one thing that must not happen
            in the server's render. */}
        {hydrated && (
          <Calendar
            autoFocus
            captionLayout="dropdown"
            defaultMonth={value?.from}
            disabled={{ before: earliest ?? new Date(0), after: latest ?? new Date() }}
            mode="range"
            numberOfMonths={2}
            onSelect={onChange}
            selected={value}
            startMonth={earliest}
            endMonth={latest}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
