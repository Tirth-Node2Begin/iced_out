"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

const LENGTH = 6;

/**
 * The six boxes a mailed code is typed into.
 *
 * ONE VALUE, SIX BOXES. The component owns no state: the parent holds the
 * string and this renders a character of it per box. A split-across-six-states
 * version of this is where the classic bugs live — a paste that only fills the
 * first box, a backspace that clears a box the caret has already left, a
 * "complete" callback that fires on a value the parent never saw.
 *
 * WHAT IT HAS TO SURVIVE, because all of it happens with a code from an email:
 *   · Pasting all six at once, into ANY box, from a mail client that helpfully
 *     appended a space or a full stop. Everything non-numeric is stripped.
 *   · Typing over a filled box — the digit replaces rather than being refused,
 *     which is what someone correcting a single mistyped character expects.
 *   · Backspace on an empty box, which steps back and clears the one before it.
 *     Without that, fixing a typo means clicking.
 *   · A browser autofilling the whole code into the first input.
 *
 * The boxes are `inputMode="numeric"` rather than `type="number"`: a number
 * input on a phone brings a keypad but also brings a spinner, accepts "e" and
 * "-", and silently drops a leading zero — and a third of these codes start
 * with one.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  label = "Verification code",
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fired once, the moment the sixth digit lands. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  /* Guards `onComplete` against firing twice for one code — a re-render, or a
     digit typed over the last box, must not re-submit a request already in
     flight. Reset as soon as the value stops being complete. */
  const announced = useRef("");

  const digits = value.slice(0, LENGTH).split("");

  useEffect(() => {
    if (value.length === LENGTH && announced.current !== value) {
      announced.current = value;
      onComplete?.(value);
    }
    if (value.length < LENGTH) announced.current = "";
  }, [value, onComplete]);

  const focusBox = useCallback((index: number) => {
    boxes.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();
  }, []);

  /* The code row is the whole reason this step exists, so it takes the caret on
     arrival — and again whenever a rejected code empties it, which is the moment
     somebody is about to retype. Keyed on emptiness rather than on mount so both
     cases go through one path. */
  useEffect(() => {
    if (value === "" && !disabled) focusBox(0);
  }, [value, disabled, focusBox]);

  /** Rebuilds the whole string, so paste and single keystroke share one path. */
  function write(index: number, typed: string) {
    let incoming = typed.replace(/\D/g, "");

    /* A box that already holds a digit reports BOTH when the next one is typed
       into it — `maxLength` is six, not one, so that a browser autofilling the
       whole code into the first box is not truncated to its first character.
       Dropping the digit already displayed here is what tells the two apart. */
    if (incoming.length > 1 && incoming[0] === digits[index]) {
      incoming = incoming.slice(1);
    }

    if (incoming === "") return;

    const next = value.padEnd(LENGTH, " ").split("");
    for (let i = 0; i < incoming.length && index + i < LENGTH; i += 1) {
      next[index + i] = incoming[i];
    }

    const joined = next.join("").replace(/\s+$/, "");
    onChange(joined.slice(0, LENGTH));
    focusBox(index + incoming.length);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        /* The value is one dense string, so this deletes a character the way
           backspace does in any text field. Typing forwards, that empties the
           box you are standing in; reaching back into the middle closes the gap
           and the digits after it shift left, which is the behaviour the same
           keystroke has everywhere else on the page. */
        onChange((value.slice(0, index) + value.slice(index + 1)).slice(0, LENGTH));
        return;
      }
      // Empty box: step back and take the one before it with us.
      if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    // Pasted into box 3 from a mail client? Six digits still fill all six.
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    write(pasted.length >= LENGTH ? 0 : index, pasted);
  }

  return (
    <div
      aria-label={label}
      className={`iox-code${invalid ? " is-invalid" : ""}`}
      role="group"
    >
      {Array.from({ length: LENGTH }).map((_, index) => (
        <input
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="iox-code__box"
          disabled={disabled}
          inputMode="numeric"
          key={index}
          maxLength={LENGTH}
          onChange={(event) => write(index, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          pattern="[0-9]*"
          ref={(node) => {
            boxes.current[index] = node;
          }}
          suppressHydrationWarning
          value={digits[index] ?? ""}
        />
      ))}
    </div>
  );
}
