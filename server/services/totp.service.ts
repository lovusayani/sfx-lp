import crypto from "crypto";
import QRCode from "qrcode";

import { env } from "../config/env";

/**
 * Authenticator-app codes (RFC 6238 TOTP: SHA-1, 6 digits, 30 s), compatible with
 * Google Authenticator, Microsoft Authenticator, Authy, 1Password…
 * Secrets are stored encrypted (AES-256-GCM) with a key derived from the server's
 * refresh-token secret — rotating that secret means users must set up their app again.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (buf: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};

const base32Decode = (input: string): Buffer => {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

const hotp = (secret: Buffer, counter: number): string => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
};

const key = () => crypto.createHash("sha256").update(`totp:${env.jwtRefreshSecret}`).digest();

export const encryptSecret = (base32: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(base32, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

export const decryptSecret = (stored: string): string => {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};

export const newTotpSecret = (): string => base32Encode(crypto.randomBytes(20));

/**
 * Check a code against the current step ±1 (allows ~30 s clock drift).
 * Returns the matched step, or null. Steps at or before `lastStep` are refused (no replay).
 */
export const verifyTotp = (base32: string, code: string, lastStep = 0): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(base32);
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [now - 1, now, now + 1]) {
    if (step <= lastStep) continue;
    const expected = hotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
};

/** otpauth:// link and a QR image (data URL) for the authenticator app. */
export const totpEnrollment = async (base32: string, account: string, issuer: string) => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const uri = `otpauth://totp/${label}?secret=${base32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { uri, qr };
};
