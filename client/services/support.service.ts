import { apiFetch } from "./api";

export type TicketStatus = "open" | "answered" | "closed";
export type TicketCategory = "account" | "deposit" | "withdrawal" | "trading" | "kyc" | "other";

export const TICKET_CATEGORIES: Array<{ value: TicketCategory; label: string }> = [
  { value: "account", label: "Account" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "trading", label: "Trading" },
  { value: "kyc", label: "Verification (KYC)" },
  { value: "other", label: "Something else" },
];

export interface TicketSummary {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  user?: { id: string; fullName: string; email: string };
}

export interface TicketMessage {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface Ticket extends TicketSummary {
  messages: TicketMessage[];
}

/* ── Client ── */

export const listMyTickets = async () => (await apiFetch<{ tickets: TicketSummary[] }>("/user/support/tickets")).tickets;

export const createTicket = async (input: { subject: string; category: TicketCategory; message: string }) =>
  (await apiFetch<{ ticket: Ticket }>("/user/support/tickets", { method: "POST", body: input })).ticket;

export const getMyTicket = async (id: string) => (await apiFetch<{ ticket: Ticket }>(`/user/support/tickets/${id}`)).ticket;

export const replyMyTicket = async (id: string, message: string) =>
  (await apiFetch<{ ticket: Ticket }>(`/user/support/tickets/${id}/reply`, { method: "POST", body: { message } })).ticket;

export const closeMyTicket = async (id: string) =>
  (await apiFetch<{ ticket: Ticket }>(`/user/support/tickets/${id}/close`, { method: "POST" })).ticket;

/* ── Admin ── */

export const adminListTickets = async (status?: TicketStatus) =>
  apiFetch<{ tickets: TicketSummary[]; counts: Record<TicketStatus, number> }>(
    `/admin/support/tickets${status ? `?status=${status}` : ""}`
  );

export const adminGetTicket = async (id: string) => (await apiFetch<{ ticket: Ticket }>(`/admin/support/tickets/${id}`)).ticket;

export const adminReplyTicket = async (id: string, message: string, close = false) =>
  (await apiFetch<{ ticket: Ticket }>(`/admin/support/tickets/${id}/reply`, { method: "POST", body: { message, close } })).ticket;

export const adminSetTicketStatus = async (id: string, status: TicketStatus) =>
  (await apiFetch<{ ticket: Ticket }>(`/admin/support/tickets/${id}/status`, { method: "PATCH", body: { status } })).ticket;

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  area: string;
  method: string;
  path: string;
  targetId: string;
  detail: string;
  ip: string;
  createdAt: string;
}

export const adminListAuditLog = async (params: { page?: number; area?: string; q?: string }) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.area) qs.set("area", params.area);
  if (params.q) qs.set("q", params.q);
  return apiFetch<{ items: AuditEntry[]; page: number; pages: number; total: number }>(`/admin/audit-log?${qs}`);
};
