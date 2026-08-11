"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createLocalStore } from "@/lib/local-store";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The one copy of who the shopper is.
 *
 * The profile screen used to hold its own hard-coded object while the account
 * rail held a second one, so a saved name changed the form and nothing else.
 * There is no backend yet, so this stands in for the `GET /me` the app will do
 * later: every screen reads the same record, and a save is visible everywhere
 * that record is shown.
 */
export type CustomerProfile = {
  name: string;
  email: string;
  mobile: string;
  /** A square data URL, or null while the initials stand in for one. */
  photo: string | null;
};

/** What a fresh device is shown before anything has been saved on it. */
export const DEFAULT_PROFILE: CustomerProfile = {
  name: "Iced_out Shopper",
  email: "shopper@example.com",
  mobile: "+91 98765 43210",
  photo: null,
};

const STORAGE_KEY = "iced-out-profile-v1";

/* The photo is stored inline in localStorage, which is a ~5MB budget for the
   whole origin — so what gets stored is a 256px square, not the 4000px one the
   phone camera produced. The file cap is on the input rather than the output
   only to fail fast: decoding a 40MB image to throw it away is the slow path. */
const PHOTO_PX = 256;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_LABEL = "5 MB";

/** "Iced_out Shopper" → "IS". Falls back to the wordmark, never to blank. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "IO";
  const letters =
    words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`;
  return letters.toUpperCase();
}

/**
 * A picked file, centre-cropped square and shrunk to something storable.
 *
 * Rejects with a sentence meant to be shown to the shopper — the caller prints
 * `error.message` rather than inventing its own copy for each failure.
 */
export async function readPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > PHOTO_MAX_BYTES) throw new Error(`Pick an image under ${PHOTO_MAX_LABEL}.`);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That image could not be read."));
      element.src = objectUrl;
    });

    /* Crop to the centre square first, so a portrait photo keeps the face
       rather than being squashed into the circle. */
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_PX;
    canvas.height = PHOTO_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("That image could not be read.");

    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      PHOTO_PX,
      PHOTO_PX,
    );

    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/* Read through `useSyncExternalStore` rather than an effect: the record has to
   be there on the first client render after hydration, and anything that has to
   *fire* first (an effect body the lint rule rejects, a `requestAnimationFrame`
   a background tab never runs) leaves the app showing the placeholder. */
const store = createLocalStore<CustomerProfile>(STORAGE_KEY, DEFAULT_PROFILE);

type ProfileContextValue = {
  profile: CustomerProfile;
  /** False for the frame between first paint and the stored record being read. */
  ready: boolean;
  initials: string;
  save: (next: CustomerProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profile = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();
  const save = useCallback((next: CustomerProfile) => store.write(next), []);

  const value = useMemo(
    () => ({ profile, ready, initials: initialsOf(profile.name), save }),
    [profile, ready, save],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}
