/* The trigger below is a `role="combobox"` whose `aria-controls` is written by
   Radix at runtime, pointing at the panel's own generated id. The rule only
   reads what is spelled out in the file, so it cannot see it. */
/* eslint-disable jsx-a11y/role-has-required-aria-props */
"use client";

import { ChevronsUpDown } from "lucide-react";
import { useCallback, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A field answered from a list that is too long to scroll blindly.
 *
 * The native `<select>` this replaces was correct and miserable: thirty-six
 * states behind an OS-drawn list that ignores every token on this page, no way
 * to type "mah" and land on Maharashtra, and a popup that renders in the system
 * palette rather than the storefront's. This is the shadcn combobox — Radix
 * Popover for the surface, cmdk for the filtering — wearing checkout's own
 * clothes rather than the registry's Tailwind defaults, which resolve to the
 * LIGHT theme in this app and would have opened a white sheet over a black page.
 *
 * The trigger keeps the id, so `focusFirstError` still finds it, and buttons are
 * labelable — the field's `<span>` label stays wired to the control the same way
 * it is for every input beside it.
 *
 * `className` is what lets the same control stand in two places. Checkout lays
 * its fields out in thirds (`co-field co-field--third`); the account's address
 * form uses its own `io-field` inside an `io-form__row`. Only the wrapper differs
 * — the trigger and the panel keep the `co-combo` styling either way, which is
 * loaded for the whole customer-session group.
 */
export function RegionField({
  className = "co-field co-field--third",
  disabled,
  emptyLabel,
  error,
  id,
  label,
  name,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: {
  className?: string;
  disabled?: boolean;
  /** What the list says when the search matches nothing. */
  emptyLabel: string;
  error?: string;
  id: string;
  label: string;
  /**
   * Submits the chosen value with the surrounding form.
   *
   * The control is a `<button>`, which browsers never submit a value for, so a
   * form that reads itself with `FormData` needs the hidden input below. Checkout
   * drives its own state and passes no name; the address forms are uncontrolled
   * and do.
   */
  name?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);

  /**
   * The dialog this field is standing in, if it is standing in one.
   *
   * Checkout is a modal, and a modal dialog switches `pointer-events` off on
   * the body and back on only inside itself — so a popover portalled to the
   * body paints correctly over the dialog and refuses every click. Found from
   * the field's own node rather than passed down: this component should not
   * need to be told where it is, and outside a dialog `null` means the default
   * body portal, which is right on a plain page.
   */
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const measure = useCallback((node: HTMLLabelElement | null) => {
    setLayer(node?.closest<HTMLElement>('[role="dialog"]') ?? null);
  }, []);

  return (
    <label className={className} htmlFor={id} ref={measure}>
      <span>{label}</span>

      {name ? <input name={name} type="hidden" value={value} /> : null}

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-describedby={error ? `${id}-error` : undefined}
            aria-expanded={open}
            aria-invalid={error ? true : undefined}
            className="co-combo"
            disabled={disabled}
            id={id}
            role="combobox"
            type="button"
          >
            <span className={value ? undefined : "co-combo__placeholder"}>
              {value || placeholder}
            </span>
            <ChevronsUpDown aria-hidden size={14} strokeWidth={1.7} />
          </button>
        </PopoverTrigger>

        {/* Aligned to the trigger and sized to it — a panel that is wider than
            the field it belongs to reads as a menu for the whole row. */}
        <PopoverContent
          align="start"
          className="co-combo__panel"
          container={layer}
          sideOffset={6}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    data-checked={option === value}
                    key={option}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    value={option}
                  >
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <em className="co-error" id={`${id}-error`}>
          {error}
        </em>
      )}
    </label>
  );
}
