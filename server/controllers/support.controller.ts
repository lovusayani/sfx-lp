import { Request, Response } from "express";

import { AuditLog } from "../models/AuditLog";
import { Counter } from "../models/Counter";
import { PushToken } from "../models/PushToken";
import { SupportTicket } from "../models/SupportTicket";
import { isPushNotificationConfigured, sendPushNotificationToTokens } from "../services/push-notification.service";
import { asyncHandler } from "../utils/asyncHandler";

const MAX_OPEN_TICKETS = 10;
const MAX_MESSAGES = 200;

const nextTicketNumber = async () => {
  const c = await Counter.findOneAndUpdate({ key: "supportTicket" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return 1000 + c.seq;
};

const fail = (res: Response, status: number, message: string): never => {
  res.status(status);
  throw new Error(message);
};

const toTicket = (t: any, forAdmin = false) => ({
  id: String(t._id),
  number: t.number,
  subject: t.subject,
  category: t.category,
  status: t.status,
  unread: forAdmin ? Boolean(t.unreadForAdmin) : Boolean(t.unreadForUser),
  lastMessageAt: t.lastMessageAt,
  createdAt: t.createdAt,
  messageCount: t.messages?.length || 0,
  ...(forAdmin && t.user && typeof t.user === "object" && "email" in t.user
    ? { user: { id: String(t.user._id), fullName: t.user.fullName, email: t.user.email } }
    : {}),
});

const withMessages = (t: any, forAdmin = false) => ({
  ...toTicket(t, forAdmin),
  messages: (t.messages || []).map((m: any) => ({
    id: String(m._id),
    fromAdmin: Boolean(m.fromAdmin),
    body: m.body,
    createdAt: m.createdAt,
  })),
});

/** Push a short note to the ticket owner; silent if push isn't set up. */
const notifyUser = async (userId: unknown, title: string, body: string, url: string) => {
  if (!isPushNotificationConfigured()) return;
  try {
    const tokens = (await PushToken.find({ user: userId }).select("token").lean()).map((t) => t.token).filter(Boolean);
    if (tokens.length) {
      await sendPushNotificationToTokens(tokens, {
        notification: { title, body },
        data: { title, body, url, type: "support_reply" },
        webpush: { fcmOptions: { link: url } },
      });
    }
  } catch (e) {
    console.error("[support] push failed:", e instanceof Error ? e.message : e);
  }
};

/* ── Client ────────────────────────────────────────────────────────── */

export const listMyTickets = asyncHandler(async (req: Request, res: Response) => {
  const tickets = await SupportTicket.find({ user: req.user!._id }).sort({ lastMessageAt: -1 }).limit(100).lean();
  return res.json({ tickets: tickets.map((t) => toTicket(t)) });
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const open = await SupportTicket.countDocuments({ user: req.user!._id, status: { $ne: "closed" } });
  if (open >= MAX_OPEN_TICKETS) fail(res, 429, "You have too many open requests. Please wait for a reply first.");
  const now = new Date();
  const ticket = await SupportTicket.create({
    number: await nextTicketNumber(),
    user: req.user!._id,
    subject: String(req.body.subject).trim(),
    category: req.body.category || "other",
    messages: [{ author: req.user!._id, fromAdmin: false, body: String(req.body.message).trim(), createdAt: now }],
    unreadForAdmin: true,
    lastMessageAt: now,
  });
  return res.status(201).json({ ticket: withMessages(ticket) });
});

export const getMyTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user!._id });
  if (!ticket) return fail(res, 404, "Request not found");
  if (ticket.unreadForUser) {
    ticket.unreadForUser = false;
    await ticket.save();
  }
  return res.json({ ticket: withMessages(ticket) });
});

export const replyMyTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user!._id });
  if (!ticket) return fail(res, 404, "Request not found");
  if (ticket.messages.length >= MAX_MESSAGES) fail(res, 400, "This conversation is full. Please open a new request.");
  ticket.messages.push({ author: req.user!._id as any, fromAdmin: false, body: String(req.body.message).trim(), createdAt: new Date() });
  ticket.status = "open"; // a reply re-opens an answered or closed request
  ticket.unreadForAdmin = true;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  return res.json({ ticket: withMessages(ticket) });
});

export const closeMyTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findOneAndUpdate({ _id: req.params.id, user: req.user!._id }, { status: "closed" }, { new: true });
  if (!ticket) return fail(res, 404, "Request not found");
  return res.json({ ticket: withMessages(ticket) });
});

/* ── Admin ─────────────────────────────────────────────────────────── */

export const adminListTickets = asyncHandler(async (req: Request, res: Response) => {
  const status = String(req.query.status || "");
  const filter: Record<string, unknown> = {};
  if (["open", "answered", "closed"].includes(status)) filter.status = status;
  const [tickets, counts] = await Promise.all([
    SupportTicket.find(filter).sort({ lastMessageAt: -1 }).limit(300).populate("user", "fullName email").lean(),
    SupportTicket.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(counts.map((c: { _id: string; n: number }) => [c._id, c.n]));
  return res.json({
    tickets: tickets.map((t) => toTicket(t, true)),
    counts: { open: byStatus.open || 0, answered: byStatus.answered || 0, closed: byStatus.closed || 0 },
  });
});

export const adminGetTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findById(req.params.id).populate("user", "fullName email");
  if (!ticket) return fail(res, 404, "Ticket not found");
  if (ticket.unreadForAdmin) {
    ticket.unreadForAdmin = false;
    await ticket.save();
  }
  return res.json({ ticket: withMessages(ticket, true) });
});

export const adminReplyTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findById(req.params.id).populate("user", "fullName email");
  if (!ticket) return fail(res, 404, "Ticket not found");
  if (ticket.messages.length >= MAX_MESSAGES) fail(res, 400, "This conversation is full.");
  ticket.messages.push({ author: req.user!._id as any, fromAdmin: true, body: String(req.body.message).trim(), createdAt: new Date() });
  ticket.status = req.body.close ? "closed" : "answered";
  ticket.unreadForUser = true;
  ticket.unreadForAdmin = false;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  const owner = ticket.user as any;
  await notifyUser(owner?._id || owner, `Support replied · #${ticket.number}`, ticket.subject, `/dashboard/support/tickets/${ticket._id}`);
  return res.json({ ticket: withMessages(ticket, true) });
});

export const adminSetTicketStatus = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).populate(
    "user",
    "fullName email"
  );
  if (!ticket) return fail(res, 404, "Ticket not found");
  return res.json({ ticket: withMessages(ticket, true) });
});

/** GET /api/admin/audit-log?area=&q=&page= — newest first, 50 per page. */
export const adminListAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const filter: Record<string, unknown> = {};
  const area = String(req.query.area || "");
  if (area) filter.area = area;
  const q = String(req.query.q || "").trim().slice(0, 60);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ adminEmail: rx }, { action: rx }, { detail: rx }, { targetId: rx }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return res.json({
    items: items.map((i) => ({
      id: String(i._id),
      adminEmail: i.adminEmail,
      action: i.action,
      area: i.area,
      method: i.method,
      path: i.path,
      targetId: i.targetId || "",
      detail: i.detail || "",
      ip: i.ip || "",
      createdAt: i.createdAt,
    })),
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});
