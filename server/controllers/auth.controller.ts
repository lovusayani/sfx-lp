import crypto from "crypto";
import { Request, Response } from "express";

import { env } from "../config/env";
import { User } from "../models/User";
import {
  checkEmailCode,
  EmailError,
  emailEnabled,
  RESET_TTL_MS,
  sendEmailCode,
  sendPasswordResetEmail,
  sha256,
} from "../services/email.service";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../services/token.service";
import { asyncHandler } from "../utils/asyncHandler";

const sanitizeUser = (user: any) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  status: user.status,
  mustChangePassword: user.mustChangePassword,
  onboardingCompleted: user.onboardingCompleted,
  kycSubmitted: user.kycSubmitted,
  kycStatus: user.kycStatus,
  kycDocuments: user.kycDocuments,
  settings: user.settings,
  twoFactorEmail: Boolean(user.twoFactorEmail),
});

/** Password rule shared with the client checklist: 6+ chars with a letter and a number (symbols optional). */
const isStrongPassword = (p: string) => p.length >= 6 && /[A-Za-z]/.test(p) && /\d/.test(p);

const fail = (res: Response, status: number, message: string): never => {
  res.status(status);
  throw new Error(message);
};

/** Turn email-service failures into the right HTTP status. */
const withEmail = async (res: Response, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof EmailError) fail(res, e.status, e.message);
    throw e;
  }
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (user.status === "suspended") fail(res, 403, "This account is suspended. Please contact support.");

  // Self-registered and not yet confirmed: send a fresh code and ask the client to verify.
  if (user.emailVerified === false) {
    if (emailEnabled()) {
      try {
        await sendEmailCode(user.email, "register", { force: true });
      } catch (e) {
        if (!(e instanceof EmailError)) throw e;
      }
    }
    return res.status(403).json({
      message: "Please confirm your email address first. We've sent you a new code.",
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
    });
  }

  // Email two-step: the password was right; finish with a code.
  if (user.twoFactorEmail && emailEnabled()) {
    await withEmail(res, () => sendEmailCode(user.email, "login", { force: true }));
    return res.json({ otpRequired: true, email: user.email });
  }

  return res.json(await issueSession(res, user));
});

const issueSession = async (res: Response, user: any) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken, user: sanitizeUser(user) };
};

/* ── Self sign-up, email codes, password reset ─────────────────────── */

export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!emailEnabled()) fail(res, 501, "Online sign-up is not open yet.");
  const fullName = String(req.body.fullName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  if (!isStrongPassword(password)) fail(res, 400, "Use at least 6 characters with a letter and a number.");

  let user = await User.findOne({ email });
  if (user && user.emailVerified !== false) {
    fail(res, 409, "An account with this email already exists. Sign in or reset your password.");
  }
  if (user) {
    // Unconfirmed earlier attempt: keep the newest details.
    user.fullName = fullName;
    user.phone = phone;
    user.password = password;
  } else {
    user = new User({ fullName, email, phone, password, role: "lp", mustChangePassword: false, emailVerified: false });
  }
  await user.save();
  await withEmail(res, () => sendEmailCode(email, "register", { force: true }));
  return res.status(201).json({ message: "Account created. Check your email for a six-digit code." });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const purpose = req.body.purpose === "login" ? "login" : "register";
  const user = await User.findOne({ email });
  if (!user || !(await checkEmailCode(email, purpose, code))) {
    return fail(res, 400, "That code is wrong or has expired. Request a new one.");
  }

  if (purpose === "register") {
    user.emailVerified = true;
    await user.save();
    return res.json({ message: "Email confirmed. You can sign in now." });
  }
  if (user.status === "suspended") fail(res, 403, "This account is suspended. Please contact support.");
  return res.json(await issueSession(res, user));
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const purpose = req.body.purpose === "login" ? "login" : "register";
  const user = await User.findOne({ email });
  // Only send where a code makes sense; the answer is the same either way.
  const eligible = user && (purpose === "register" ? user.emailVerified === false : user.twoFactorEmail);
  if (eligible) await withEmail(res, () => sendEmailCode(email, purpose));
  return res.json({ message: "If that account is waiting for a code, a new one is on its way." });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!emailEnabled()) fail(res, 501, "Email recovery is not enabled yet.");
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });
  if (user && user.status !== "suspended") {
    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetHash = sha256(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();
    try {
      await sendPasswordResetEmail(user.email, user.fullName, token);
    } catch (e) {
      if (!(e instanceof EmailError)) throw e;
      console.error(`[email] reset mail failed for ${email}: ${e.message}`);
    }
  }
  // Same answer whether or not the account exists.
  return res.json({ message: "If an account exists for that email, a reset link is on its way." });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token || "");
  const newPassword = String(req.body.newPassword || "");
  if (!/^[a-f0-9]{64}$/.test(token)) fail(res, 400, "This reset link is invalid or has expired.");
  if (!isStrongPassword(newPassword)) fail(res, 400, "Use at least 6 characters with a letter and a number.");
  const user = await User.findOne({ passwordResetHash: sha256(token), passwordResetExpires: { $gt: new Date() } });
  if (!user) return fail(res, 400, "This reset link is invalid or has expired.");
  user.password = newPassword;
  user.mustChangePassword = false;
  user.passwordResetHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined; // signs out other sessions
  if (user.emailVerified === false) user.emailVerified = true; // the link proves the inbox
  await user.save();
  return res.json({ message: "Password updated. You can now sign in." });
});

/** Turn the emailed sign-in code on or off for the signed-in user. */
export const setTwoFactorEmail = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) return fail(res, 401, "Unauthorized");
  const enabled = Boolean(req.body.enabled);
  if (enabled && !emailEnabled()) fail(res, 501, "Email codes are not available yet.");
  req.user.twoFactorEmail = enabled;
  await req.user.save();
  return res.json({ message: enabled ? "Sign-in codes are on." : "Sign-in codes are off.", user: sanitizeUser(req.user) });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const incomingToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingToken) {
    res.status(401);
    throw new Error("Refresh token required");
  }

  const decoded = verifyRefreshToken(incomingToken);
  const user = await User.findById(decoded.userId);

  if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(incomingToken)) {
    res.status(401);
    throw new Error("Invalid refresh token");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);

  return res.json({
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    req.user.refreshTokenHash = undefined;
    await req.user.save();
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res.json({ message: "Logged out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  return res.json({ user: sanitizeUser(req.user) });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const { currentPassword, newPassword } = req.body;
  if (!isStrongPassword(String(newPassword || ""))) fail(res, 400, "Use at least 6 characters with a letter and a number.");

  const isValid = await req.user.comparePassword(currentPassword);
  if (!isValid) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  req.user.password = newPassword;
  req.user.mustChangePassword = false;
  await req.user.save();

  return res.json({ message: "Password updated successfully" });
});
