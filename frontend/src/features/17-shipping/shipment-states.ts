/**
 * The vocabularies a parcel's record is drawn from.
 *
 * Split out of `data/shipment-fixtures.ts`, which held these constants beside a
 * hand-written list of demo parcels. The parcels are gone — the register reads
 * `/admin/shipments` — but the vocabularies are still needed by the filter chips,
 * which name every state whether or not a parcel is in it.
 *
 * Kept free of `"use client"`: plain data, so a server component can read it.
 */

/**
 * The states a parcel can be in. There is no "ready" — an order waiting to go
 * out is an ORDER, and it becomes a shipment at the moment it is dispatched.
 *
 * These are the machine's own alphabet (spec §9.4) and match the `status` values
 * the transition endpoint accepts. Not a settings vocabulary: renaming one would
 * break the state machine rather than relabel it.
 */
export const SHIPMENT_STATES = ["Dispatched", "In transit", "Delivered", "Failed", "Cancelled"] as const;
export type ShipmentState = (typeof SHIPMENT_STATES)[number];

/**
 * The couriers on offer in the dispatch dialog.
 *
 * This IS a settings vocabulary on the server — `ShipmentService` checks a
 * provider against `shipping.couriers` in `store_settings` and refuses one it
 * does not recognise. The list here is the default that ships with the seed; a
 * courier added in settings and not added here simply is not offered, and one
 * offered here that settings does not have is refused on dispatch.
 */
export const COURIERS = ["Blue Dart", "Delhivery", "Ecom Express"] as const;
