"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { BRANDING_EVENT, getBrandingSnapshot } from "@/components/sfx/useBranding";

export type FrontendTheme = "dark" | "light" | "system";

/** The user's own choice (only used when the admin allows it). */
export const FRONTEND_THEME_KEY = "sfx_theme";
/** The admin panel's own theme, chosen with the toggle in the admin header. */
export const ADMIN_THEME_KEY = "sfx_admin_theme";
export const FRONTEND_THEME_EVENT = "sfx-theme-changed";

const isTheme = (value: unknown): value is FrontendTheme => value === "dark" || value === "light" || value === "system";

const readKey = (key: string): FrontendTheme | null => {
  try {
    const v = window.localStorage.getItem(key);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
};

const writeKey = (key: string, theme: FrontendTheme) => {
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    // storage unavailable (private mode) — theme still applies for this session
  }
  window.dispatchEvent(new CustomEvent(FRONTEND_THEME_EVENT, { detail: theme }));
};

/** Theme for the client app: the admin's choice, or the user's own when the admin allows it. */
export const resolveAppTheme = (): FrontendTheme => {
  const b = getBrandingSnapshot();
  const own = readKey(FRONTEND_THEME_KEY);
  return b.allowUserTheme && own ? own : b.appTheme;
};

export const readAdminTheme = (): FrontendTheme => readKey(ADMIN_THEME_KEY) || "dark";

export const setFrontendTheme = (theme: FrontendTheme): void => writeKey(FRONTEND_THEME_KEY, theme);
export const setAdminTheme = (theme: FrontendTheme): void => writeKey(ADMIN_THEME_KEY, theme);

const subscribeTheme = (cb: () => void) => {
  window.addEventListener(FRONTEND_THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(FRONTEND_THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Admin header toggle: current admin theme, re-rendering on change. */
export const useAdminTheme = (): FrontendTheme => useSyncExternalStore(subscribeTheme, readAdminTheme, () => "dark");

const resolve = (theme: FrontendTheme): "dark" | "light" => {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const apply = (theme: FrontendTheme) => {
  const root = document.documentElement;
  const resolved = resolve(theme);
  root.classList.remove(resolved === "light" ? "dark" : "light", "rose");
  root.classList.add(resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f6f4ec" : "#0b0c0a");
};

/** Keeps <html class="dark|light"> in sync with the right theme for the current area. */
export function FrontendThemeController() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    apply(isAdmin ? readAdminTheme() : resolveAppTheme());
  }, [isAdmin, tick]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    window.addEventListener("storage", bump);
    window.addEventListener(FRONTEND_THEME_EVENT, bump);
    window.addEventListener(BRANDING_EVENT, bump);
    media.addEventListener("change", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(FRONTEND_THEME_EVENT, bump);
      window.removeEventListener(BRANDING_EVENT, bump);
      media.removeEventListener("change", bump);
    };
  }, []);

  return null;
}
