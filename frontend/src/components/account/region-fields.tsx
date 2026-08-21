"use client";

import { useState } from "react";

import { RegionField } from "@/features/04-cart/components/region-field";
import {
  INDIAN_STATES,
  citiesOf,
  cityBelongsTo,
  withCurrent,
} from "@/features/04-cart/india-regions";

/**
 * The state and city pair, for the account's address forms.
 *
 * Checkout has had these two as dependent dropdowns for a while — pick a state
 * and the city list becomes that state's — and the address forms did not: they
 * were two free-text boxes. So an address saved from the profile could hold
 * "Bengaluru, Maharashtra", or "surat" against "Gujarat" spelled four ways, and
 * checkout would then offer the shopper a state dropdown that could not match
 * what their own saved address said.
 *
 * This is the same `RegionField` combobox checkout uses, wearing the account
 * form's skin, with the dependency wired the same way:
 *
 *   · the city list is the chosen state's, and is disabled until one is chosen;
 *   · changing the state clears a city that does not belong to the new one, and
 *     keeps it when it does — re-picking the same state must not wipe the answer;
 *   · `withCurrent` keeps an already-saved value selectable even when it is not
 *     on the list, so an address written before the list existed is editable
 *     rather than silently blanked.
 *
 * Both fields submit through hidden inputs, because the two forms that use this
 * are uncontrolled and read themselves with `FormData`.
 */
export function RegionFields({
  city: initialCity = "",
  idPrefix,
  state: initialState = "",
}: {
  /** The address being edited, or empty for a new one. */
  city?: string;
  /** Keeps the two ids unique when more than one of these is on a page. */
  idPrefix: string;
  state?: string;
}) {
  const [state, setState] = useState(initialState);
  const [city, setCity] = useState(initialCity);

  const cities = citiesOf(state);

  return (
    <>
      <RegionField
        className="io-field"
        emptyLabel="No state matches that."
        id={`${idPrefix}-state`}
        label="State"
        name="state"
        onChange={(next) => {
          setState(next);
          /* A city that does not belong to the newly chosen state is cleared
             rather than left standing — that pairing is the whole thing these
             two fields exist to prevent. */
          setCity((current) => (cityBelongsTo(next, current) ? current : ""));
        }}
        options={withCurrent(INDIAN_STATES, state)}
        placeholder="Choose a state"
        searchPlaceholder="Search states…"
        value={state}
      />

      <RegionField
        className="io-field"
        /* Held until there is a state to narrow by: a city list of every city in
           India is not a shorter question than typing one. */
        disabled={state === ""}
        emptyLabel="No city matches that."
        id={`${idPrefix}-city`}
        label="City"
        name="city"
        onChange={setCity}
        options={withCurrent(cities, city)}
        placeholder={state === "" ? "Choose a state first" : "Choose a city"}
        searchPlaceholder="Search cities…"
        value={city}
      />
    </>
  );
}
