"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquarePlus } from "lucide-react";

import { createTicket, listMyTickets, TICKET_CATEGORIES, TicketCategory, TicketSummary } from "@/services/support.service";

import { EmptyState, Skeleton } from "./ActivityList";
import { cn } from "./cn";
import { formatDate } from "./format";
import { Sheet, TextArea } from "./kit";
import { Alert, Button, Chip, Field, SectionTitle, SelectField } from "./ui";

const STATUS: Record<TicketSummary["status"], { label: string; tone: "gold" | "neutral" | "success" }> = {
  open: { label: "WAITING", tone: "neutral" },
  answered: { label: "REPLIED", tone: "gold" },
  closed: { label: "CLOSED", tone: "success" },
};

/** "My requests" on the Support screen: list + new request sheet. */
export function SupportRequests() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    listMyTickets().then(
      (t) => alive && setTickets(t),
      () => alive && setTickets([])
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  return (
    <section className="flex max-w-[720px] flex-col gap-3" aria-label="My requests">
      <SectionTitle
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="sfx-press inline-flex items-center gap-1.5 rounded-[12px] bg-sfx-gold-soft px-3 py-1.5 text-[12px] font-semibold text-sfx-accent hover:brightness-110"
          >
            <MessageSquarePlus size={14} /> New request
          </button>
        }
      >
        My requests
      </SectionTitle>
      {tickets === null ? (
        <Skeleton className="h-[120px]" />
      ) : tickets.length === 0 ? (
        <EmptyState title="No requests yet" body="Ask us anything about your account, deposits, withdrawals or trading." />
      ) : (
        <ul className="sfx-card sfx-stagger divide-y divide-sfx-line px-4 py-1">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/support/tickets/${t.id}`} className="flex items-center gap-3 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sfx-gold" aria-label="New reply" />}
                    <span className={cn("truncate text-[14px] text-sfx-text", t.unread && "font-semibold")}>{t.subject}</span>
                  </span>
                  <span className="block text-[12px] text-sfx-muted">
                    #{t.number} · {formatDate(t.lastMessageAt)}
                  </span>
                </span>
                <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
                <ChevronRight size={16} className="shrink-0 text-sfx-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewRequestSheet open={open} onClose={() => setOpen(false)} onCreated={() => (setOpen(false), setReload((n) => n + 1))} />
    </section>
  );
}

function NewRequestSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("account");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) return setError("Add a short subject.");
    if (!message.trim()) return setError("Tell us what you need help with.");
    setBusy(true);
    setError("");
    try {
      await createTicket({ subject: subject.trim(), category, message: message.trim() });
      setSubject("");
      setMessage("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="New request">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <SelectField label="Topic" value={category} onChange={(v) => setCategory(v as TicketCategory)} options={TICKET_CATEGORIES} />
        <Field label="Subject" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Deposit not showing yet" />
        <TextArea label="Message" value={message} maxLength={4000} rows={5} onChange={(e) => setMessage(e.target.value)} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy}>
          Send request
        </Button>
      </form>
    </Sheet>
  );
}
