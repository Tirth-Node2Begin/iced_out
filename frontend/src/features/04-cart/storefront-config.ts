"use client";

import { useSyncExternalStore } from "react";

import { publicClient } from "@/api/clients";
import { createRemoteRecord } from "@/lib/remote-store";

/**
 * What delivery costs, read from the store's own settings.
 *
 * These three numbers — the free-delivery threshold and the two fees — were
 * constants in the browser, written out in six files. They are
 * `store_settings.delivery` on the server, which is where they belong: an
 * operator edits them in `/admin/settings/store`, and `GET /config/storefront`
 * has always served them. Nothing read it.
 *
 * That was not a cosmetic duplication. `PlaceOrderService` re-prices every
 * order from the catalogue and then CROSS-CHECKS the total the browser sent
 * against the one it computed, refusing the order on a mismatch. So the first
 * time somebody raised the standard fee in settings, the shop would have gone
 * on quoting the old one, and every checkout would have failed with "Prices
 * changed while you were checking out. Please refresh and try again." —
 * advice that could not work, because the number the page was quoting came from
 * a constant a refresh does not change. The bag would have been unbuyable until
 * somebody redeployed the frontend.
 *
 * The constants are kept as the FALLBACK, for the moment before the request
 * lands: a summary that opens with no delivery line is worse than one that
 * opens with the usual figures and corrects itself a beat later. They are the
 * same defaults the server falls back to, so the two agree when the settings
 * table is empty.
 */

export type DeliveryMethod = "standard" | "express";

export type StorefrontConfig = {
  currency: string;
  /** Merchandise subtotal at which standard delivery stops being charged. */
  freeDeliveryOver: number;
  standardFee: number;
  expressFee: number;
  /** Working days, `[first, last]`. */
  standardWindow: [number, number];
  expressWindow: [number, number];
};

/** Mirrors the server's own defaults — see `SystemController::storefront`. */
export const CONFIG_FALLBACK: StorefrontConfig = {
  currency: "INR",
  freeDeliveryOver: 4999,
  standardFee: 199,
  expressFee: 499,
  standardWindow: [3, 5],
  expressWindow: [1, 2],
};

type Payload = {
  currency?: string;
  free_delivery_over?: number;
  delivery?: {
    standard?: { fee?: number; window?: number[] };
    express?: { fee?: number; window?: number[] };
  };
};

/** A window that may have arrived short or malformed, as the pair we need. */
function windowOf(given: number[] | undefined, fallback: [number, number]): [number, number] {
  return Array.isArray(given) && given.length >= 2 && given.every((n) => Number.isFinite(n))
    ? [given[0], given[1]]
    : fallback;
}

const record = createRemoteRecord<StorefrontConfig>(async () => {
  const response = await publicClient.get<{ data: Payload }>("/config/storefront");
  const payload = response.data.data ?? {};

  return {
    currency: payload.currency ?? CONFIG_FALLBACK.currency,
    freeDeliveryOver: payload.free_delivery_over ?? CONFIG_FALLBACK.freeDeliveryOver,
    standardFee: payload.delivery?.standard?.fee ?? CONFIG_FALLBACK.standardFee,
    expressFee: payload.delivery?.express?.fee ?? CONFIG_FALLBACK.expressFee,
    standardWindow: windowOf(payload.delivery?.standard?.window, CONFIG_FALLBACK.standardWindow),
    expressWindow: windowOf(payload.delivery?.express?.window, CONFIG_FALLBACK.expressWindow),
  };
});

/**
 * The settings, for a component — re-renders when they land.
 *
 * `getSnapshot` starts the load, so the first screen that asks is what fetches
 * it, and every screen after that reads the held copy.
 */
export function useStorefrontConfig(): StorefrontConfig {
  return (
    useSyncExternalStore(record.subscribe, record.getSnapshot, record.getServerSnapshot).data ??
    CONFIG_FALLBACK
  );
}

/**
 * The settings, for a caller that is not a component.
 *
 * `deliveryFee` and `deliveryEstimate` are called from the handler that places
 * an order, not during render, and they cannot hold a hook. This reads whatever
 * the store is holding by then — which is the loaded settings, because the
 * checkout screen subscribed to them several steps earlier — and the fallback
 * only in the case where nothing has ever read them.
 *
 * Reading it starts the load if nothing has yet, the same as the hook does —
 * so the one call that finds an empty store answers with the fallback and every
 * call after it has the settings.
 */
export function peekStorefrontConfig(): StorefrontConfig {
  return record.getSnapshot().data ?? CONFIG_FALLBACK;
}

/** Drops the held settings — after a change on the settings screen. */
export function resetStorefrontConfig() {
  record.reset();
}
