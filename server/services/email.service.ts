import crypto from "crypto";

import { env } from "../config/env";
import { Branding } from "../models/Branding";
import { EmailCode, EmailCodePurpose } from "../models/EmailCode";

/** Thrown when email can't be used; `status` is the HTTP status to answer with. */
export class EmailError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const CODE_TTL_MS = 3 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 45 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const RESET_TTL_MS = 30 * 60 * 1000;

export const emailEnabled = () => Boolean(env.resendApiKey);
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const appName = async () => {
  try {
    const b = await Branding.findOne({ key: "default" }).lean();
    return b?.appName || "Swiss Liquidity";
  } catch {
    return "Swiss Liquidity";
  }
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Dark, gold-accented layout matching the app; plain table HTML for mail clients. */
const layout = (brand: string, heading: string, bodyHtml: string) => `<!doctype html>
<html><body style="margin:0;background:#0b0c0a;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f4f1e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0c0a;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151612;border:1px solid #3a3720;border-radius:24px;padding:32px">
<tr><td style="font-size:16px;font-weight:700;letter-spacing:.06em;color:#f4d24f">${esc(brand.toUpperCase())}</td></tr>
<tr><td style="padding-top:24px;font-size:24px;font-weight:700;line-height:1.25;color:#f4f1e8">${esc(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#b9b5a6">${bodyHtml}</td></tr>
<tr><td style="padding-top:28px;font-size:11px;letter-spacing:.08em;color:#7d7a6d">${esc(brand.toUpperCase())} / PRIVATE &amp; SECURE</td></tr>
</table></td></tr></table></body></html>`;

const send = async (to: string, subject: string, html: string, text: string) => {
  if (!emailEnabled()) throw new EmailError("Email is not configured on this server yet.", 501);
  const brand = await appName();
  const from = env.emailFrom.includes("<") ? env.emailFrom : `${brand} <${env.emailFrom}>`;
  let response: globalThis.Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new EmailError("We couldn't reach the email service. Please try again shortly.", 502);
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    // Logged for the operator; the key is never part of the message.
    console.error(`[email] Resend rejected message to ${to}: ${response.status} ${detail.message || ""}`);
    throw new EmailError("We couldn't send the email. Please try again later or contact support.", 502);
  }
};

/** Create (or replace) a code for this email + purpose and send it. */
export const sendEmailCode = async (email: string, purpose: EmailCodePurpose, opts: { force?: boolean } = {}) => {
  const existing = await EmailCode.findOne({ email, purpose });
  if (existing && !opts.force && Date.now() - existing.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new EmailError("Please wait a moment before requesting another code.", 429);
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await EmailCode.findOneAndUpdate(
    { email, purpose },
    { codeHash: sha256(`${email}:${purpose}:${code}`), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), sentAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const brand = await appName();
  const what = purpose === "register" ? "confirm your email address" : "finish signing in";
  await send(
    email,
    `${code} is your ${brand} code`,
    layout(
      brand,
      "Your one-time code",
      `Use this code to ${what}:<div style="margin:20px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#f4d24f">${code}</div>It expires in 3 minutes. If you didn't ask for it, you can ignore this email.`
    ),
    `Your ${brand} code is ${code}. Use it to ${what}. It expires in 3 minutes.`
  );
};

/** Check a code. Consumes it on success; counts failed attempts. */
export const checkEmailCode = async (email: string, purpose: EmailCodePurpose, code: string): Promise<boolean> => {
  const record = await EmailCode.findOne({ email, purpose });
  if (!record || record.expiresAt.getTime() < Date.now()) return false;
  if (record.attempts >= MAX_CODE_ATTEMPTS) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(sha256(`${email}:${purpose}:${code}`)));
  if (!ok) {
    record.attempts += 1;
    await record.save();
    return false;
  }
  await record.deleteOne();
  return true;
};

export const sendPasswordResetEmail = async (email: string, fullName: string, token: string) => {
  const brand = await appName();
  const link = `${env.clientUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  await send(
    email,
    `Reset your ${brand} password`,
    layout(
      brand,
      "Reset your password",
      `Hi ${esc(fullName.split(" ")[0] || "there")}, we received a request to reset your password.<div style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#f4d24f;color:#14130d;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:14px">Choose a new password</a></div>This link works once and expires in 30 minutes. If you didn't ask for it, you can ignore this email — your password stays the same.`
    ),
    `Reset your ${brand} password: ${link}\nThis link works once and expires in 30 minutes.`
  );
};
