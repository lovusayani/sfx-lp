import crypto from "crypto";
import { Types } from "mongoose";

import { env } from "../config/env";
import { ILicenseState, LicenseState } from "../models/LicenseState";

/**
 * Licence switch controlled by the vendor from a Google Sheet (published as CSV).
 *
 * Sheet columns (header row, any order):  app | locked | amount | currency | pay_to | note | qr_url
 *   - the row whose `app` equals LICENSE_APP_ID is used
 *   - locked: ON/OFF, TRUE/FALSE, YES/NO, 1/0
 *
 * Rules:
 *   - Checked every LICENSE_POLL_MINUTES (default 5). The sheet URL never leaves the server.
 *   - If the sheet can't be read, the LAST KNOWN state is kept (no surprise lock/unlock).
 *   - A fresh install with a sheet configured starts LOCKED until the sheet is read
 *     (LICENSE_DEFAULT_LOCKED=false to change). With no sheet configured, never locked.
 */

export interface LicensePublic {
  locked: boolean;
  amount: string;
  currency: string;
  payTo: string;
  note: string;
  qrUrl: string;
  reference: string;
}

let cache: ILicenseState | null = null;
let timer: NodeJS.Timeout | null = null;

const truthy = (v: string) => /^(on|true|yes|y|1|locked)$/i.test(v.trim());

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas/newlines in quotes). */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

export const pickRow = (rows: string[][], appId: string): Record<string, string> | null => {
  if (rows.length < 2) return null;
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const r of rows.slice(1)) {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => (rec[h] = (r[i] ?? "").trim()));
    if ((rec.app || "").toLowerCase() === appId.toLowerCase()) return rec;
  }
  return null;
};

const newReference = () => `SLQ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const ensureState = async (): Promise<ILicenseState> => {
  if (cache) return cache;
  let state = await LicenseState.findOne({ key: "default" });
  if (!state) {
    state = await LicenseState.create({
      key: "default",
      locked: Boolean(env.licenseSheetCsvUrl) && env.licenseDefaultLocked,
      reference: newReference(),
    });
  }
  cache = state;
  return state;
};

export const refreshLicense = async (): Promise<ILicenseState> => {
  const state = await ensureState();
  if (!env.licenseSheetCsvUrl) {
    if (state.locked) {
      state.locked = false;
      state.lastChangedAt = new Date();
      await state.save();
    }
    return state;
  }
  try {
    const res = await fetch(env.licenseSheetCsvUrl, { signal: AbortSignal.timeout(15000), redirect: "follow" });
    if (!res.ok) throw new Error(`sheet HTTP ${res.status}`);
    const row = pickRow(parseCsv(await res.text()), env.licenseAppId);
    if (!row) throw new Error(`no row for app "${env.licenseAppId}"`);

    const locked = truthy(row.locked || "");
    if (locked !== state.locked) {
      state.lastChangedAt = new Date();
      console.log(`[license] ${locked ? "LOCKED" : "UNLOCKED"} by sheet`);
      if (!locked) state.allowedUserId = null; // reset the single-user pin once paid
    }
    state.locked = locked;
    state.amount = row.amount || "";
    state.currency = row.currency || "";
    state.payTo = row.pay_to || "";
    state.note = row.note || "";
    state.qrUrl = row.qr_url || "";
    state.lastError = "";
  } catch (error) {
    // Keep the last known state on any failure.
    state.lastError = error instanceof Error ? error.message : String(error);
    console.warn(`[license] sheet check failed, keeping last state (${state.locked ? "locked" : "unlocked"}): ${state.lastError}`);
  }
  state.lastCheckedAt = new Date();
  await state.save();
  return state;
};

export const startLicenseWatcher = async (): Promise<void> => {
  await refreshLicense().catch((e) => console.warn("[license] initial check failed", e));
  if (timer) clearInterval(timer);
  timer = setInterval(() => void refreshLicense().catch(() => undefined), env.licensePollMinutes * 60 * 1000);
  timer.unref();
};

export const getLicense = async (): Promise<ILicenseState> => ensureState();

export const toPublic = (s: ILicenseState): LicensePublic => ({
  locked: s.locked,
  amount: s.amount || "",
  currency: s.currency || "",
  payTo: s.payTo || "",
  note: s.note || "",
  qrUrl: s.qrUrl || "",
  reference: s.reference,
});

/**
 * While locked only ONE LP account may use the app: the first one to sign in.
 * Returns true if this user may proceed. Admins are never limited here.
 */
export const claimOrCheckSeat = async (userId: Types.ObjectId | string, role: string): Promise<boolean> => {
  if (role === "admin") return true;
  const state = await ensureState();
  if (!state.locked) return true;
  if (!state.allowedUserId) {
    // Atomic claim so two simultaneous logins can't both take the seat.
    const claimed = await LicenseState.findOneAndUpdate(
      { key: "default", $or: [{ allowedUserId: null }, { allowedUserId: { $exists: false } }] },
      { $set: { allowedUserId: new Types.ObjectId(String(userId)) } },
      { new: true }
    );
    if (claimed) {
      cache = claimed;
      return true;
    }
    cache = null;
    const fresh = await ensureState();
    return String(fresh.allowedUserId) === String(userId);
  }
  return String(state.allowedUserId) === String(userId);
};

export const LICENSE_ERROR_CODE = "LICENSE_PENDING";
