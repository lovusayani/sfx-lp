import { ApiError, apiFetch } from "./api";
import { clearSession, getSession, setSession, updateSessionUser } from "./session.service";
import { AuthSession, User } from "@/types";

let inFlightHydration: Promise<User | null> | null = null;

/** Password was accepted but an emailed code is needed (sign-in code, or unconfirmed sign-up). */
export class CodeRequiredError extends Error {
  constructor(
    message: string,
    public email: string,
    public purpose: "login" | "register",
    public method: "email" | "totp" = "email"
  ) {
    super(message);
  }
}

export const verifyRoute = (e: CodeRequiredError) =>
  `/verify?email=${encodeURIComponent(e.email)}&purpose=${e.purpose}${e.method === "totp" ? "&method=totp" : ""}`;

export const loginUser = async (email: string, password: string): Promise<User> => {
  let data: AuthSession | { otpRequired: true; email: string; method?: "totp" };
  try {
    data = await apiFetch<AuthSession | { otpRequired: true; email: string; method?: "totp" }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.data.code === "EMAIL_NOT_VERIFIED") {
      throw new CodeRequiredError(error.message, String(error.data.email || email), "register");
    }
    throw error;
  }
  if ("otpRequired" in data) {
    if (data.method === "totp") throw new CodeRequiredError("Enter the code from your authenticator app.", data.email, "login", "totp");
    throw new CodeRequiredError("We emailed you a sign-in code.", data.email, "login");
  }
  setSession(data);
  const { clearLicenseForced } = await import("@/components/license/licenseStore");
  clearLicenseForced();
  return data.user;
};

/** Sign-in with an emailed code: returns the user once the code is accepted. */
export const verifyLoginCode = async (email: string, code: string): Promise<User> => {
  const data = await apiFetch<AuthSession>("/auth/verify-otp", {
    method: "POST",
    body: { email, code, purpose: "login" },
    auth: false,
  });
  setSession(data);
  const { clearLicenseForced } = await import("@/components/license/licenseStore");
  clearLicenseForced();
  return data.user;
};

/** Turn the emailed sign-in code on or off. */
export const setTwoFactorEmail = async (enabled: boolean): Promise<User> => {
  const data = await apiFetch<{ user: User }>("/auth/two-factor", { method: "POST", body: { enabled } });
  updateSessionUser(data.user);
  return data.user;
};

/** Authenticator app: step 1 returns a QR code and the secret to type in manually. */
export const startTotpSetup = async (): Promise<{ secret: string; uri: string; qr: string }> =>
  apiFetch("/auth/totp/setup", { method: "POST" });

/** Step 2: confirm with a code from the app to switch it on. */
export const enableTotp = async (code: string): Promise<User> => {
  const data = await apiFetch<{ user: User }>("/auth/totp/enable", { method: "POST", body: { code } });
  updateSessionUser(data.user);
  return data.user;
};

/** Switch the authenticator off with a current code or the account password. */
export const disableTotp = async (proof: { code?: string; password?: string }): Promise<User> => {
  const data = await apiFetch<{ user: User }>("/auth/totp/disable", { method: "POST", body: proof });
  updateSessionUser(data.user);
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

/* ── Features shown in the new design that need new API endpoints ──────────
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
    "Online sign-up is not open yet. Please contact support and we will create your account."
  );

export const requestPasswordReset = (email: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/forgot-password",
    { email },
    "Email recovery is not enabled yet. Please contact support to reset your password."
  );

export const resetPasswordWithToken = (token: string, newPassword: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/reset-password",
    { token, newPassword },
    "This reset link can't be used yet. Please contact support."
  );

export const verifyOtpCode = (email: string, code: string, purpose: string) =>
  callOptionalEndpoint<{ message: string }>(
    "/auth/verify-otp",
    { email, code, purpose },
    "Code verification is not enabled yet."
  );

export const resendOtpCode = (email: string, purpose: string) =>
  callOptionalEndpoint<{ message: string }>("/auth/resend-otp", { email, purpose }, "Code verification is not enabled yet.");
