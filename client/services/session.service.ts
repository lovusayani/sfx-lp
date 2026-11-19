import { AuthSession, User } from "@/types";

const SESSION_KEY = "sfx_auth_session";
const KYC_SKIPPED_KEY = "sfx_kyc_skipped";
const REMEMBER_KEY = "sfx_remember_device";

/** "Remember this device": persist across browser restarts (localStorage) or only for this tab session. */
export const setRememberDevice = (remember: boolean): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
};

export const getRememberDevice = (): boolean => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "false";
};

const sessionStore = (): Storage => (getRememberDevice() ? localStorage : sessionStorage);

export const getSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
};

export const setSession = (session: AuthSession): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStore().setItem(SESSION_KEY, JSON.stringify(session));
};

export const updateSessionUser = (user: User): void => {
  const existing = getSession();
  if (!existing) {
    return;
  }

  setSession({ ...existing, user });
};

export const clearSession = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(KYC_SKIPPED_KEY);
};

export const markKycSkipped = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(KYC_SKIPPED_KEY, "true");
};

export const clearKycSkipped = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(KYC_SKIPPED_KEY);
};

export const isKycSkipped = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(KYC_SKIPPED_KEY) === "true";
};

export const getNextRoute = (user: User | null): string => {
  if (!user) {
    return "/welcome";
  }
  if (user.role === "admin") {
    return "/admin";
  }
  if (user.mustChangePassword) {
    return "/reset-password";
  }
  if (!user.onboardingCompleted) {
    return "/onboarding";
  }
  if (!user.kycSubmitted && !isKycSkipped()) {
    return "/kyc";
  }
  return "/dashboard";
};
