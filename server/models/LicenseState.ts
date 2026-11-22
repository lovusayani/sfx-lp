import { Document, Model, Schema, Types, model } from "mongoose";

/** Last known licence state, persisted so a restart or Google outage never flips it. */
export interface ILicenseState extends Document {
  key: string;
  locked: boolean;
  amount?: string;
  currency?: string;
  payTo?: string;
  payName?: string;
  note?: string;
  qrUrl?: string;
  reference: string;
  /** While locked, the single LP account allowed to use the app (first to sign in). */
  allowedUserId?: Types.ObjectId | null;
  lastCheckedAt?: Date;
  lastChangedAt?: Date;
  lastError?: string;
}

const licenseStateSchema = new Schema<ILicenseState>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    locked: { type: Boolean, default: false },
    amount: String,
    currency: String,
    payTo: String,
    payName: String,
    note: String,
    qrUrl: String,
    reference: { type: String, required: true },
    allowedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastCheckedAt: Date,
    lastChangedAt: Date,
    lastError: String,
  },
  { timestamps: true }
);

export const LicenseState: Model<ILicenseState> = model<ILicenseState>("LicenseState", licenseStateSchema);
