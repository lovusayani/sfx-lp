"use client";

import { useSyncExternalStore } from "react";

import { getBrandingAssets } from "@/services/branding.service";

export interface Branding {
  appName: string;
  shortName: string;
}

/** Defaults until the admin sets a name (Admin → Setup). */
export const DEFAULT_BRANDING: Branding = { appName: "Swiss Liquidity", shortName: "SLq" };

const CACHE_KEY = "sfx_branding";
let current: Branding = DEFAULT_BRANDING;
let started = false;
const listeners = new Set<() => void>();

const load = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.appName) current = { appName: cached.appName, shortName: cached.shortName || DEFAULT_BRANDING.shortName };
  } catch {
    // ignore unreadable cache
  }
  getBrandingAssets()
    .then((b) => {
      const next = { appName: b.appName || DEFAULT_BRANDING.appName, shortName: b.shortName || DEFAULT_BRANDING.shortName };
      if (next.appName === current.appName && next.shortName === current.shortName) return;
      current = next;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      listeners.forEach((l) => l());
    })
    .catch(() => undefined);
};

const subscribe = (listener: () => void) => {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Product name set by the admin; cached so it paints instantly on repeat visits. */
export const useBranding = (): Branding =>
  useSyncExternalStore(subscribe, () => current, () => DEFAULT_BRANDING);
