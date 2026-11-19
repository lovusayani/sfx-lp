"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type FrontendTheme = "dark" | "light" | "system";

export const FRONTEND_THEME_KEY = "sfx_theme";
export const FRONTEND_THEME_EVENT = "sfx-theme-changed";
/** SfX LP is designed dark-first; "system" is opt-in from Settings. */
export const DEFAULT_THEME: FrontendTheme = "dark";

const isTheme = (value: string | null): value is FrontendTheme =>
  value === "dark" || value === "light" || value === "system";

export const readStoredTheme = (): FrontendTheme => {
  try {
    const stored = window.localStorage.getItem(FRONTEND_THEME_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const setFrontendTheme = (theme: FrontendTheme): void => {
  try {
    window.localStorage.setItem(FRONTEND_THEME_KEY, theme);
  } catch {
    // storage unavailable (private mode) — theme still applies for this session
  }
  window.dispatchEvent(new CustomEvent(FRONTEND_THEME_EVENT, { detail: theme }));
};

const resolve = (theme: FrontendTheme): "dark" | "light" => {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const apply = (theme: FrontendTheme, enabled: boolean) => {
  const root = document.documentElement;
  root.classList.remove("dark", "light", "rose");
  if (!enabled) return;
  const resolved = resolve(theme);
  root.classList.add(resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f6f4ec" : "#0b0c0a");
};

export function FrontendThemeController() {
  const pathname = usePathname();
  // Theme is never rendered, only applied to <html>, so reading storage at init is hydration-safe.
  const [theme, setTheme] = useState<FrontendTheme>(() =>
    typeof window === "undefined" ? DEFAULT_THEME : readStoredTheme()
  );
  const enabled = !pathname.startsWith("/admin");

  useEffect(() => {
    apply(theme, enabled);
  }, [enabled, theme]);

  useEffect(() => {
    const sync = () => setTheme(readStoredTheme());
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystem = () => theme === "system" && apply("system", enabled);
    window.addEventListener("storage", sync);
    window.addEventListener(FRONTEND_THEME_EVENT, sync);
    media.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FRONTEND_THEME_EVENT, sync);
      media.removeEventListener("change", onSystem);
    };
  }, [enabled, theme]);

  return null;
}
