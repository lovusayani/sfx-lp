import { NextFunction, Request, Response } from "express";

import { AuditLog } from "../models/AuditLog";

/** Friendly names for admin actions, keyed by "METHOD /route/pattern". */
const ACTIONS: Record<string, [area: string, action: string]> = {
  "POST /users": ["Users", "Created a user"],
  "PATCH /users/:id/kyc-status": ["KYC", "Reviewed KYC"],
  "PATCH /users/:id/status": ["Users", "Changed account status"],
  "PATCH /users/:id/password": ["Users", "Reset a user password"],
  "PATCH /users/:id/lock-in-balance": ["Users", "Changed lock-in balance"],
  "PATCH /users/:id/main-balance": ["Wallets", "Adjusted main wallet"],
  "PUT /page-content/:slug": ["Support", "Edited a content page"],
  "PATCH /setup/branding-name": ["Settings", "Changed app name"],
  "PATCH /setup/theme": ["Settings", "Changed app theme"],
  "POST /setup/logos/:variant": ["Settings", "Uploaded a logo"],
  "PATCH /payment-setup": ["Settings", "Changed deposit wallets"],
  "POST /payment-setup/qr/:network": ["Settings", "Uploaded a deposit QR"],
  "DELETE /payment-setup/qr/:network": ["Settings", "Removed a deposit QR"],
  "POST /notifications/send-all": ["Notices", "Sent push to everyone"],
  "POST /notifications/users/:id/send": ["Notices", "Sent push to a user"],
  "PATCH /notifications/users/:id/push-preference": ["Users", "Changed push setting"],
  "POST /trades": ["Trading", "Posted a trade result"],
  "PATCH /deposits/:id/status": ["Deposits", "Reviewed a deposit"],
  "PATCH /withdrawals/:id/status": ["Withdrawals", "Reviewed a withdrawal"],
  "POST /pnl-uploads": ["Reports", "Uploaded P&L reports"],
  "DELETE /pnl-uploads/:id": ["Reports", "Deleted a P&L report"],
  "POST /api-sources": ["Trading", "Added an API source"],
  "PATCH /api-sources/:id": ["Trading", "Changed an API source"],
  "DELETE /api-sources/:id": ["Trading", "Deleted an API source"],
  "PUT /api-sources/:id/users": ["Trading", "Assigned API source clients"],
  "PUT /charge-settings/global": ["Trading", "Changed global charge"],
  "PUT /charge-settings/symbol/:symbol": ["Trading", "Changed symbol charge"],
  "DELETE /charge-settings/symbol/:symbol": ["Trading", "Removed symbol charge"],
  "PUT /charge-settings/user/:userId/global": ["Trading", "Changed client charge"],
  "PUT /charge-settings/user/:userId/symbol/:symbol": ["Trading", "Changed client symbol charge"],
  "DELETE /charge-settings/user/:userId/global": ["Trading", "Removed client charge"],
  "DELETE /charge-settings/user/:userId/symbol/:symbol": ["Trading", "Removed client symbol charge"],
  "POST /charge-settings/backfill": ["Trading", "Recalculated past charges"],
  "DELETE /order-charges": ["Trading", "Deleted order charges"],
  "POST /notices": ["Notices", "Published a notice"],
  "POST /data/reset": ["Settings", "Reset data"],
  "POST /support/tickets/:id/reply": ["Support", "Replied to a ticket"],
  "PATCH /support/tickets/:id/status": ["Support", "Changed ticket status"],
};

/** Short, non-secret summary of what changed. Passwords and keys are never recorded. */
const SAFE_FIELDS = ["status", "amount", "type", "category", "appTheme", "symbol", "network", "variant", "title", "email", "slug"];

const describe = (req: Request): string => {
  const body = (req.body || {}) as Record<string, unknown>;
  const params = (req.params || {}) as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of SAFE_FIELDS) {
    const v = body[key] ?? params[key];
    if (v !== undefined && v !== null && v !== "" && typeof v !== "object") parts.push(`${key}: ${String(v).slice(0, 60)}`);
  }
  return parts.join(" · ").slice(0, 300);
};

/** Records every successful admin change (non-GET, status < 400). Never blocks the request. */
export const auditAdminActions = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.user || !req.route?.path) return;
    const key = `${req.method} ${req.route.path}`;
    const [area, action] = ACTIONS[key] || ["Other", key];
    const p = (req.params || {}) as Record<string, string | undefined>;
    const targetId = p.id || p.userId || p.slug || p.network || "";
    AuditLog.create({
      admin: req.user._id,
      adminEmail: req.user.email,
      action,
      area,
      method: req.method,
      path: req.originalUrl.split("?")[0].slice(0, 300),
      targetId: targetId || undefined,
      detail: describe(req) || undefined,
      ip: req.ip,
    }).catch((e) => console.error("[audit] could not record:", e instanceof Error ? e.message : e));
  });
  return next();
};
