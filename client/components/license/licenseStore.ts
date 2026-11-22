"use client";

import { useSyncExternalStore } from "react";

import { apiFetch, LICENSE_EVENT } from "@/services/api";

export interface LicenseInfo {
  locked: boolean;
  amount: string;
  currency: string;
  payTo: string;
  note: string;
  qrUrl: string;
  reference: string;
}

interface LicenseSnapshot {
  info: LicenseInfo | null;
  /** Set when the API refused a request because payment is pending (e.g. second user, locked section). */
  forced: boolean;
}

let snapshot: LicenseSnapshot = { info: null, forced: false };
const listeners = new Set<() => void>();
let started = false;

const emit = (next: Partial<LicenseSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
};

export const refreshLicenseStatus = async (): Promise<LicenseInfo | null> => {
  try {
    const { license } = await apiFetch<{ license: LicenseInfo }>("/license/status", { auth: false });
    emit({ info: license, forced: license.locked ? snapshot.forced : false });
    return license;
  } catch {
    return snapshot.info;
  }
};

const start = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener(LICENSE_EVENT, (e) => {
    const detail = (e as CustomEvent<LicenseInfo | undefined>).detail;
    // Admin locks are page-based (see LicenseGate); only app users get the sticky notice.
    const isAdmin = window.location.pathname.startsWith("/admin");
    emit({ forced: isAdmin ? snapshot.forced : true, info: detail ?? snapshot.info });
  });
  void refreshLicenseStatus();
  // Re-check regularly so unlocking in the sheet clears the notice without a reload.
  window.setInterval(() => void refreshLicenseStatus(), 60_000);
};

/** Called after a successful sign-in so a previously refused user is not stuck behind the notice. */
export const clearLicenseForced = () => {
  if (snapshot.forced) emit({ forced: false });
};

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useLicense = (): LicenseSnapshot =>
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
