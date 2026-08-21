"use client";

import { useCallback, useMemo } from "react";

import { adminClient } from "@/api/clients";
import { useAdminRecord } from "@/api/use-register";
import type { HeroBoard } from "@/features/19b-home-hero/types/hero-slide";

/** The console's one hero endpoint. Every verb below hangs off it. */
export const HERO_PATH = "/admin/home/hero";

/**
 * How long to wait on a write that triggers a cutout.
 *
 * The shared client allows twelve seconds, which is right for a console read
 * and wrong for this: saving a slide sends the photograph to remove.bg and
 * waits for the answer, and a large frame regularly takes longer than that.
 *
 * The server is not affected either way — it finishes the cutout whether or not
 * the browser is still listening, and the state lands on the slide — so a
 * timeout here would only ever be the console lying about what happened. This
 * is the number that stops it.
 */
const CUTOUT_TIMEOUT_MS = 90_000;

export type HeroDraft = {
  /**
   * Where the frame comes from. Omitted on a patch means "leave it as it is" —
   * so a request that only carries `alt` cannot silently convert an uploaded
   * slide into a product one.
   */
  source?: "upload" | "product";
  /** The URL `POST /admin/media` returned. Required when `source` is upload. */
  image?: string;
  /** A product slug — required when `source` is product, "" to unlink. */
  product?: string;
  alt?: string;
  active?: boolean;
};

export type HeroVerbs = {
  board: HeroBoard | null;
  loading: boolean;
  /** False until the endpoint has answered — an empty hero vs an unread one. */
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
  add: (draft: HeroDraft) => Promise<void>;
  save: (id: string, draft: HeroDraft) => Promise<void>;
  /** Re-runs the background removal on the photograph already stored. */
  recut: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * The hero board, read from and written to the database.
 *
 * Every verb re-reads afterwards rather than splicing the response into what is
 * held. The endpoint answers with the WHOLE board for exactly this reason: a
 * reorder moves every position, a delete closes the gap behind it, and a create
 * appends — so patching one card into a held list is how the console ends up
 * showing a running order the server does not agree with.
 */
export function useHeroBoard(): HeroVerbs {
  const record = useAdminRecord<HeroBoard>(HERO_PATH);
  const { reload } = record;

  const add = useCallback(
    async (draft: HeroDraft) => {
      await adminClient.post(HERO_PATH, draft, { timeout: CUTOUT_TIMEOUT_MS });
      await reload();
    },
    [reload],
  );

  const save = useCallback(
    async (id: string, draft: HeroDraft) => {
      await adminClient.patch(`${HERO_PATH}/${encodeURIComponent(id)}`, draft, {
        /* A patch only spends time at remove.bg when it can change which frame
           gets cut — a new upload, a different product, or a switch between the
           two sources. Waiting the long timeout on an alt-text fix would be
           harmless but wrong: a request that cannot take ninety seconds should
           not be allowed ninety seconds to hang. */
        timeout:
          draft.image === undefined && draft.product === undefined && draft.source === undefined
            ? undefined
            : CUTOUT_TIMEOUT_MS,
      });
      await reload();
    },
    [reload],
  );

  const recut = useCallback(
    async (id: string) => {
      await adminClient.post(
        `${HERO_PATH}/${encodeURIComponent(id)}/cutout`,
        {},
        { timeout: CUTOUT_TIMEOUT_MS },
      );
      await reload();
    },
    [reload],
  );

  const reorder = useCallback(
    async (ids: string[]) => {
      await adminClient.post(`${HERO_PATH}/order`, { order: ids });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await adminClient.delete(`${HERO_PATH}/${encodeURIComponent(id)}`);
      await reload();
    },
    [reload],
  );

  return useMemo(
    () => ({
      board: record.data,
      loading: record.loading,
      loaded: record.loaded,
      error: record.error,
      reload,
      add,
      save,
      recut,
      reorder,
      remove,
    }),
    [add, recut, record.data, record.error, record.loaded, record.loading, reload, remove, reorder, save],
  );
}
