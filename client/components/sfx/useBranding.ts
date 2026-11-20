"use client";

import { useSyncExternalStore } from "react";

import { getPublicAssetUrl } from "@/services/api";
import { BrandingAssets, getBrandingAssets } from "@/services/branding.service";

export type AppTheme = "dark" | "light" | "system";

export interface Branding {
  appName: string;
  shortName: string;
  /** Full URLs of uploaded logos ("" = none uploaded). */
  darkLogo: string;
  lightLogo: string;
  mobileLogo: string;
  /** Theme the admin set for every app user. */
  appTheme: AppTheme;
  /** Whether users may pick their own theme in Settings. */
  allowUserTheme: boolean;
}

/** Defaults until the admin sets a name (Admin → Settings). */
export const DEFAULT_BRANDING: Branding = {
  appName: "Swiss Liquidity",
  shortName: "SLq",
  darkLogo: "",
  lightLogo: "",
  mobileLogo: "",
  appTheme: "dark",
  allowUserTheme: false,
};

const CACHE_KEY = "sfx_branding";
/** Read by the pre-paint theme script in app/layout.tsx. */
export const APP_THEME_KEY = "sfx_app_theme";
export const ALLOW_USER_THEME_KEY = "sfx_allow_user_theme";
export const BRANDING_EVENT = "sfx-branding-changed";

let current: Branding = DEFAULT_BRANDING;
let started = false;
const listeners = new Set<() => void>();

const isTheme = (v: unknown): v is AppTheme => v === "dark" || v === "light" || v === "system";

const fromAssets = (b: BrandingAssets): Branding => ({
  appName: b.appName || DEFAULT_BRANDING.appName,
  shortName: b.shortName || DEFAULT_BRANDING.shortName,
  darkLogo: b.darkLogoPath ? getPublicAssetUrl(b.darkLogoPath) : "",
  lightLogo: b.lightLogoPath ? getPublicAssetUrl(b.lightLogoPath) : "",
  mobileLogo: b.mobileLogoPath ? getPublicAssetUrl(b.mobileLogoPath) : "",
  appTheme: isTheme(b.appTheme) ? b.appTheme : "dark",
  allowUserTheme: Boolean(b.allowUserTheme),
});

const publish = (next: Branding) => {
  const same = (Object.keys(next) as Array<keyof Branding>).every((k) => next[k] === current[k]);
  if (same) return;
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    localStorage.setItem(APP_THEME_KEY, next.appTheme);
    localStorage.setItem(ALLOW_USER_THEME_KEY, next.allowUserTheme ? "1" : "0");
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event(BRANDING_EVENT));
};

const load = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.appName) current = { ...DEFAULT_BRANDING, ...cached };
  } catch {
    // ignore unreadable cache
  }
  getBrandingAssets()
    .then((b) => publish(fromAssets(b)))
    .catch(() => undefined);
};

/** Admin screens call this after saving so every open view updates at once. */
export const applyBrandingAssets = (b: BrandingAssets) => publish(fromAssets(b));

/** Current branding without subscribing (for non-React code). */
export const getBrandingSnapshot = (): Branding => {
  load();
  return current;
};

const subscribe = (listener: () => void) => {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Product name, logos and app theme set by the admin; cached so they paint instantly on repeat visits. */
export const useBranding = (): Branding =>
  useSyncExternalStore(subscribe, () => current, () => DEFAULT_BRANDING);
