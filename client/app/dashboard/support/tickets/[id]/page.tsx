"use client";

import { FormEvent, use, useEffect, useState } from "react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { TextArea } from "@/components/sfx/kit";
import { Alert, Button, Chip, Display, TopBar } from "@/components/sfx/ui";
import { closeMyTicket, getMyTicket, replyMyTicket, Ticket, TICKET_CATEGORIES } from "@/services/support.service";

/** One support request: the conversation and a reply box. */
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"" | "reply" | "close">("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getMyTicket(id).then(
      (t) => alive && setTicket(t),
      () => alive && setTicket(null)
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return setError("Write a message first.");
    setBusy("reply");
    setError("");
    try {
      setTicket(await replyMyTicket(id, reply.trim()));
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send your message.");
    } finally {
      setBusy("");
    }
  };

  const close = async () => {
    setBusy("close");
    setError("");
    try {
      setTicket(await closeMyTicket(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t close this request.");
    } finally {
      setBusy("");
    }
  };

  if (ticket === undefined) {
    return (
      <div className="flex flex-col gap-3.5">
        <TopBar backHref="/dashboard/support" caption="SUPPORT" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  }
  if (ticket === null) {
    return (
      <div className="flex flex-col gap-3.5">
        <TopBar backHref="/dashboard/support" caption="SUPPORT" />
        <EmptyState title="Request not found" body="It may have been removed. Go back to see your requests." />
      </div>
    );
  }

  const category = TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label || ticket.category;

  return (
    <div className="flex max-w-[720px] flex-col gap-3.5">
      <TopBar backHref="/dashboard/support" caption={`REQUEST #${ticket.number}`} />
      <Display size="md" title={ticket.subject} subtitle={category} />
      <div className="flex items-center gap-2">
        <Chip tone={ticket.status === "answered" ? "gold" : ticket.status === "closed" ? "success" : "neutral"}>
          {ticket.status === "answered" ? "REPLIED" : ticket.status === "closed" ? "CLOSED" : "WAITING FOR SUPPORT"}
        </Chip>
      </div>

      <ol className="sfx-stagger flex flex-col gap-3">
        {ticket.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "max-w-[88%] rounded-[12px] px-4 py-3 text-[14px]",
              m.fromAdmin ? "self-start border border-sfx-border bg-sfx-gold-soft/50 text-sfx-text" : "self-end bg-sfx-surface-2 text-sfx-text"
            )}
          >
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="mt-1.5 text-[11px] text-sfx-muted">
              {m.fromAdmin ? "Support team" : "You"} · {new Date(m.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>

      <form onSubmit={send} className="sfx-card flex flex-col gap-3 p-4">
        <TextArea
          label={ticket.status === "closed" ? "Write to re-open this request" : "Your message"}
          value={reply}
          maxLength={4000}
          rows={4}
          onChange={(e) => setReply(e.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy === "reply"} className="sm:w-auto sm:px-6">
            Send
          </Button>
          {ticket.status !== "closed" && (
            <Button type="button" variant="secondary" loading={busy === "close"} onClick={close} className="sm:w-auto sm:px-6">
              Mark as solved
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
