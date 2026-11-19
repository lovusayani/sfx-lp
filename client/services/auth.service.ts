import { ApiError, apiFetch } from "./api";
import { clearSession, getSession, setSession, updateSessionUser } from "./session.service";
import { AuthSession, User } from "@/types";

let inFlightHydration: Promise<User | null> | null = null;

export const loginUser = async (email: string, password: string): Promise<User> => {
  const data = await apiFetch<AuthSession>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setSession(data);
  return data.user;
};

export const hydrateUser = async (): Promise<User | null> => {
  const session = getSession();
  if (!session?.accessToken) {
    return null;
  }

  if (inFlightHydration) {
    return inFlightHydration;
  }

  inFlightHydration = (async () => {
    try {
      const data = await apiFetch<{ user: User }>("/auth/me", { method: "GET" });
      updateSessionUser(data.user);
      return data.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        return session.user || null;
      }

      clearSession();
      return null;
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
};

export const changeUserPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await apiFetch<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });

  const data = await apiFetch<{ user: User }>("/auth/me", { method: "GET" });
  updateSessionUser(data.user);
};

export const logoutUser = async (): Promise<void> => {
  try {
    await apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
};

/* ── Features shown in the SfX design that need new API endpoints ──────────
   These call endpoints that are not live yet. Until the backend enables them,
   a 404/405 is turned into a clear, friendly message instead of a raw error. */

export class FeatureUnavailableError extends Error {}

const callOptionalEndpoint = async <T>(path: string, body: unknown, unavailableMessage: string): Promise<T> => {
  try {
    return await apiFetch<T>(path, { method: "POST", body, auth: false });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501)) {
      throw new FeatureUnavailableError(unavailableMessage);
    }
    throw error;
  }
};

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export const registerAccount = (payload: RegisterPayload) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/register",
    payload,
    "Online sign-up is not open yet. Please contact SfX LP support and we will create your account."
  );

export const requestPasswordReset = (email: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/forgot-password",
    { email },
    "Email recovery is not enabled yet. Please contact SfX LP support to reset your password."
  );

export const resetPasswordWithToken = (token: string, newPassword: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/reset-password",
    { token, newPassword },
    "This reset link can't be used yet. Please contact SfX LP support."
  );

export const verifyOtpCode = (email: string, code: string, purpose: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/verify-otp",
    { email, code, purpose },
    "Code verification is not enabled yet."
  );

export const resendOtpCode = (email: string, purpose: string) =>
  callOptionalEndpoint<{ message: string }>("/auth/resend-otp", { email, purpose }, "Code verification is not enabled yet.");
