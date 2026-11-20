"use client";

import { FormEvent, useEffect, useState } from "react";

import { ago, Btn, Dialog, Empty, FilterChips, Loading, Panel, Pill, Row, Rows, StatCard, StatGrid } from "@/components/admin/ui";
import { cn } from "@/components/sfx/cn";
import { TextArea } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import {
  adminGetTicket,
  adminListTickets,
  adminReplyTicket,
  adminSetTicketStatus,
  Ticket,
  TICKET_CATEGORIES,
  TicketStatus,
  TicketSummary,
} from "@/services/support.service";

type Filter = "all" | TicketStatus;
const categoryLabel = (c: string) => TICKET_CATEGORIES.find((x) => x.value === c)?.label || c;

/** Admin → Support → Tickets: client requests, replies and status. */
export default function AdminTicketsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [counts, setCounts] = useState<Record<TicketStatus, number>>({ open: 0, answered: 0, closed: 0 });
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    adminListTickets(filter === "all" ? undefined : filter).then(
      (r) => alive && (setTickets(r.tickets), setCounts(r.counts), setError("")),
      (e) => alive && (setTickets([]), setError(e instanceof Error ? e.message : "Couldn’t load tickets."))
    );
    return () => {
      alive = false;
    };
  }, [filter, reload]);

  const total = counts.open + counts.answered + counts.closed;

  return (
    <>
      <StatGrid>
        <StatCard label="Waiting for a reply" value={String(counts.open)} />
        <StatCard label="Answered" value={String(counts.answered)} />
        <StatCard label="Closed" value={String(counts.closed)} />
      </StatGrid>

      <Panel title="Client requests" aside={`${total} in total`}>
        <FilterChips
          value={filter}
          onChange={(v) => (setTickets(null), setFilter(v))}
          label="Status"
          options={[
            { value: "open", label: "Open", count: counts.open },
            { value: "answered", label: "Answered", count: counts.answered },
            { value: "closed", label: "Closed", count: counts.closed },
            { value: "all", label: "All" },
          ]}
        />
        {error && <Alert className="my-3">{error}</Alert>}
        {tickets === null ? (
          <Loading />
        ) : tickets.length === 0 ? (
          <Empty title="No requests here" body="New client requests appear in Open." />
        ) : (
          <Rows>
            {tickets.map((t) => (
              <Row
                key={t.id}
                title={
                  <span className="inline-flex items-center gap-2">
                    {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sfx-gold" aria-label="New message" />}
                    #{t.number} · {t.subject}
                  </span>
                }
                sub={`${t.user?.fullName || "Client"} · ${t.user?.email || ""}`}
                middle={categoryLabel(t.category)}
                middleSub={`${t.messageCount} message${t.messageCount === 1 ? "" : "s"} · ${ago(t.lastMessageAt)}`}
                status={<Pill status={t.status} />}
                onView={() => setOpenId(t.id)}
                viewLabel="Open"
              />
            ))}
          </Rows>
        )}
      </Panel>

      {openId && (
        <TicketDialog
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => setReload((n) => n + 1)}
        />
      )}
    </>
  );
}

function TicketDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"" | "reply" | "close" | "status">("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    adminGetTicket(id).then(
      (t) => {
        if (!alive) return;
        setTicket(t);
        onChanged(); // unread flag cleared
      },
      (e) => alive && setError(e instanceof Error ? e.message : "Couldn’t open this ticket.")
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const send = async (close: boolean, e?: FormEvent) => {
    e?.preventDefault();
    if (!reply.trim()) return setError("Write a reply first.");
    setBusy(close ? "close" : "reply");
    setError("");
    try {
      setTicket(await adminReplyTicket(id, reply.trim(), close));
      setReply("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send the reply.");
    } finally {
      setBusy("");
    }
  };

  const setStatus = async (status: TicketStatus) => {
    setBusy("status");
    setError("");
    try {
      setTicket(await adminSetTicketStatus(id, status));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t change the status.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={ticket ? `#${ticket.number} · ${ticket.subject}` : "Ticket"}
      footer={
        ticket && (
          <>
            {ticket.status === "closed" ? (
              <Btn variant="secondary" loading={busy === "status"} onClick={() => setStatus("open")}>
                Re-open
              </Btn>
            ) : (
              <Btn variant="secondary" loading={busy === "status"} onClick={() => setStatus("closed")}>
                Close without reply
              </Btn>
            )}
            <Btn variant="secondary" loading={busy === "close"} onClick={() => send(true)}>
              Reply &amp; close
            </Btn>
            <Btn loading={busy === "reply"} onClick={() => send(false)}>
              Send reply
            </Btn>
          </>
        )
      }
    >
      {!ticket ? (
        error ? <Alert>{error}</Alert> : <Loading rows={3} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-sfx-muted">
            <Pill status={ticket.status} />
            <span>{categoryLabel(ticket.category)}</span>
            <span>·</span>
            <span>
              {ticket.user?.fullName} ({ticket.user?.email})
            </span>
          </div>
          <ol className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto pr-1">
            {ticket.messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-[12px] px-4 py-3 text-[14px]",
                  m.fromAdmin ? "self-end bg-sfx-gold-soft text-sfx-text" : "self-start border border-sfx-line bg-sfx-surface-2 text-sfx-text"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1.5 text-[11px] text-sfx-muted">
                  {m.fromAdmin ? "Support" : "Client"} · {new Date(m.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
          <form onSubmit={(e) => send(false, e)}>
            <TextArea label="Your reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={4000} />
          </form>
          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </Dialog>
  );
}
