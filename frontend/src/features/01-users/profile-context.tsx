"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { customerClient } from "@/api/clients";
import { useAuth } from "@/features/20-auth-security/auth-context";

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

/**
 * What renders while nobody is signed in.
 *
 * Deliberately empty rather than a sample shopper: a placeholder with a real
 * name and email in it is indistinguishable from a signed-in account, which is
 * exactly how a fresh registration used to open onto somebody else's profile.
 */
export const DEFAULT_PROFILE: CustomerProfile = {
  name: "",
  email: "",
  mobile: "",
  photo: null,
};

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

type ProfileContextValue = {
  profile: CustomerProfile;
  /** False until the account has been read back from the API. */
  ready: boolean;
  initials: string;
  save: (next: CustomerProfile) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * The one copy of who the shopper is — now the account the API returns.
 *
 * This used to be a `localStorage` record seeded with a fixture, which is why
 * a brand-new account opened onto "Iced_out Shopper": the browser had a profile
 * before the shopper had one. The signed-in customer comes from
 * `GET /auth/session` through the auth provider, and a save is a `PATCH /me`
 * whose response becomes the new record — so what is on screen is always what
 * the database holds.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { customer, sessionReady, refreshCustomer } = useAuth();

  const save = useCallback(
    async (next: CustomerProfile) => {
      await customerClient.patch("/me", {
        name: next.name,
        email: next.email,
        mobile: next.mobile,
      });
      await refreshCustomer();
    },
    [refreshCustomer],
  );

  /* A signed-out visitor sees the placeholder rather than a crash: the account
     screens are behind a guard, and the rail renders on public pages too. */
  const profile = customer ?? DEFAULT_PROFILE;

  const value = useMemo(
    () => ({ profile, ready: sessionReady, initials: initialsOf(profile.name), save }),
    [profile, save, sessionReady],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}
