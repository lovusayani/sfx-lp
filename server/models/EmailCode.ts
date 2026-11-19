import { Document, Model, Schema, model } from "mongoose";

export type EmailCodePurpose = "register" | "login";

/** One-time six-digit codes sent by email. Stored hashed; removed by MongoDB once expired. */
export interface IEmailCode extends Document {
  email: string;
  purpose: EmailCodePurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  sentAt: Date;
}

interface IEmailCodeModel extends Model<IEmailCode> {}

const emailCodeSchema = new Schema<IEmailCode>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ["register", "login"], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
  }
);

emailCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });
emailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailCode = model<IEmailCode, IEmailCodeModel>("EmailCode", emailCodeSchema);
