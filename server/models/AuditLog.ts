import { Document, Model, Schema, model } from "mongoose";

/** One admin action that changed something (kept for a year). */
export interface IAuditLog extends Document {
  admin?: Schema.Types.ObjectId;
  adminEmail: string;
  action: string;
  area: string;
  method: string;
  path: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  createdAt?: Date;
}

interface IAuditLogModel extends Model<IAuditLog> {}

const auditLogSchema = new Schema<IAuditLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User" },
    adminEmail: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    area: { type: String, required: true, trim: true, maxlength: 40 },
    method: { type: String, required: true },
    path: { type: String, required: true, maxlength: 300 },
    targetId: { type: String, trim: true, maxlength: 120 },
    detail: { type: String, trim: true, maxlength: 300 },
    ip: { type: String, trim: true, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ area: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = model<IAuditLog, IAuditLogModel>("AuditLog", auditLogSchema);
