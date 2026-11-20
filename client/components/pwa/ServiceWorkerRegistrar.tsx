"use client";

import { useEffect } from "react";

import { appServiceWorkerUrl } from "@/services/push-notifications.service";

/** Registers the app's service worker (offline page + push) once the page has loaded. Not on the admin panel. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (location.pathname.startsWith("/admin")) return;
    const register = () => {
      navigator.serviceWorker.getRegistration("/").then((existing) => {
        if (existing) return;
        navigator.serviceWorker.register(appServiceWorkerUrl(), { scope: "/" }).catch(() => undefined);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
