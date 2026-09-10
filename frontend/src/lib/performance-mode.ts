"use client";

import { useEffect, useState } from "react";

export type PerformanceMode = "high" | "medium" | "low";

export type PerformanceProfile = {
  mode: PerformanceMode;
  reducedMotion: boolean;
  saveData: boolean;
  slowConnection: boolean;
  phone: boolean;
  smallScreen: boolean;
  memory?: number;
  cores?: number;
};

type ConnectionHints = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorHints = Navigator & {
  connection?: ConnectionHints;
  deviceMemory?: number;
};

const DEFAULT_PROFILE: PerformanceProfile = {
  mode: "high",
  reducedMotion: false,
  saveData: false,
  slowConnection: false,
  phone: false,
  smallScreen: false,
};

function readMatch(query: string) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function classifyProfile(): PerformanceProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DEFAULT_PROFILE;
  }

  const nav = navigator as NavigatorHints;
  const connection = nav.connection;
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
  const cores =
    typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = connection?.effectiveType ?? "";
  const slowConnection = /(^slow-2g$|^2g$)/.test(effectiveType);
  const reducedMotion = readMatch("(prefers-reduced-motion: reduce)");
  const coarsePointer = readMatch("(pointer: coarse)");
  const viewportWidth = Math.min(
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.screen?.width || Number.POSITIVE_INFINITY,
  );
  const viewportHeight = Math.min(
    window.innerHeight || Number.POSITIVE_INFINITY,
    window.screen?.height || Number.POSITIVE_INFINITY,
  );
  const smallScreen = viewportWidth <= 700 || viewportHeight <= 560;
  const phone = coarsePointer && viewportWidth <= 780;

  const lowMemory = memory !== undefined && memory <= 3;
  const constrainedMemory = memory !== undefined && memory <= 4;
  const weakCpu = cores !== undefined && cores <= 4;
  const modestCpu = cores !== undefined && cores <= 6;
  const modestMemory = memory !== undefined && memory <= 6;

  const low =
    reducedMotion ||
    saveData ||
    slowConnection ||
    lowMemory ||
    (phone && (constrainedMemory || weakCpu || viewportWidth <= 430)) ||
    (smallScreen && constrainedMemory && weakCpu);

  const medium =
    !low && (phone || viewportWidth <= 1024 || modestCpu || modestMemory || smallScreen);

  return {
    mode: low ? "low" : medium ? "medium" : "high",
    reducedMotion,
    saveData,
    slowConnection,
    phone,
    smallScreen,
    memory,
    cores,
  };
}

function sameProfile(a: PerformanceProfile, b: PerformanceProfile) {
  return (
    a.mode === b.mode &&
    a.reducedMotion === b.reducedMotion &&
    a.saveData === b.saveData &&
    a.slowConnection === b.slowConnection &&
    a.phone === b.phone &&
    a.smallScreen === b.smallScreen &&
    a.memory === b.memory &&
    a.cores === b.cores
  );
}

export function getPerformanceProfile() {
  return classifyProfile();
}

export function applyPerformanceProfile(profile = getPerformanceProfile()) {
  if (typeof document === "undefined") return profile;

  const root = document.documentElement;
  root.dataset.performanceMode = profile.mode;
  root.dataset.motion = profile.reducedMotion ? "reduced" : "full";
  root.dataset.saveData = profile.saveData ? "true" : "false";
  return profile;
}

export function shouldUseSmoothScroll(profile = getPerformanceProfile()) {
  return (
    profile.mode !== "low" &&
    !profile.phone &&
    !profile.reducedMotion &&
    !profile.saveData &&
    !profile.slowConnection
  );
}

export function shouldWarmNonCriticalChunks(profile = getPerformanceProfile()) {
  return profile.mode === "high" && !profile.saveData && !profile.slowConnection;
}

export function runWhenIdle(callback: () => void, timeout = 1800) {
  if (typeof window === "undefined") return () => {};

  let cancelled = false;
  const run = () => {
    if (!cancelled) callback();
  };

  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(handle);
    };
  }

  const handle = window.setTimeout(run, Math.min(timeout, 1600));
  return () => {
    cancelled = true;
    window.clearTimeout(handle);
  };
}

export function usePerformanceProfile() {
  const [profile, setProfile] = useState<PerformanceProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const next = applyPerformanceProfile();
      setProfile((current) => (sameProfile(current, next) ? current : next));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as NavigatorHints).connection;

    read();
    window.addEventListener("resize", schedule, { passive: true });
    reducedMotion.addEventListener("change", schedule);
    connection?.addEventListener("change", schedule);

    return () => {
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      connection?.removeEventListener("change", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return profile;
}
