"use client";

import { useEffect, useMemo, useState } from "react";

import { ago, Btn, Empty, Loading, OpsNote, PageHeader, Panel, Pill, Rows, SearchBox, StatCard, StatGrid } from "@/components/admin/ui";
import { Pager, Segmented, TextArea } from "@/components/sfx/kit";
import { Alert, Checkbox, Field, SelectField } from "@/components/sfx/ui";
import {
  AdminLpUser,
  AdminNoticeRecord,
  AdminNotificationOverview,
  getAdminNotices,
  getAdminNotificationOverview,
  getAllLpUsers,
  sendAdminNotice,
  sendAdminPushToAllUsers,
  sendAdminPushToSingleUser,
} from "@/services/admin.service";

const PAGE = 10;
const errText = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

/** Notices: in-app announcements (Notices screen) with an optional push notification. */
export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<AdminNoticeRecord[] | null>(null);
  const [users, setUsers] = useState<AdminLpUser[]>([]);
  const [push, setPush] = useState<AdminNotificationOverview | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [userId, setUserId] = useState("");
  const [alsoPush, setAlsoPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  const fetchAll = () => Promise.allSettled([getAdminNotices(), getAllLpUsers(), getAdminNotificationOverview()]);
  const apply = ([n, u, p]: Awaited<ReturnType<typeof fetchAll>>) => {
    setNotices(n.status === "fulfilled" ? n.value : []);
    setUsers(u.status === "fulfilled" ? u.value : []);
    setPush(p.status === "fulfilled" ? p.value : null);
    if (n.status === "rejected") setError(errText(n.reason, "Couldn’t load notices."));
  };

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => notices || [], [notices]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((n) => !q || `${n.title} ${n.message} ${n.targetUser?.fullName || ""}`.toLowerCase().includes(q));
  }, [list, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const pushReady = Boolean(push?.serverConfigured);

  const send = async () => {
    if (!title.trim() || !message.trim()) return setMsg({ tone: "danger", text: "Add a title and a message." });
    if (target === "user" && !userId) return setMsg({ tone: "danger", text: "Choose the client to notify." });
    setBusy(true);
    setMsg(null);
    try {
      await sendAdminNotice({ title: title.trim(), message: message.trim(), target, userId: target === "user" ? userId : undefined });
      let note = "Notice published.";
      if (alsoPush && pushReady) {
        try {
          const body = message.trim().length > 140 ? `${message.trim().slice(0, 137)}…` : message.trim();
          const payload = { title: title.trim(), body, url: "/dashboard/notices" };
          const r = target === "all" ? await sendAdminPushToAllUsers(payload) : await sendAdminPushToSingleUser(userId, payload);
          note += ` Push delivered to ${r.successCount} device${r.successCount === 1 ? "" : "s"}${r.failureCount ? `, ${r.failureCount} failed` : ""}.`;
        } catch (e) {
          note += ` Push failed: ${errText(e, "unknown error")}.`;
        }
      }
      setTitle("");
      setMessage("");
      setMsg({ tone: "success", text: note });
      setPage(1);
      fetchAll().then(apply);
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t publish the notice.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Notices" />

      <StatGrid>
        <StatCard label="Notices published" value={notices ? list.length : "—"} />
        <StatCard label="Clients with push on" value={push ? `${push.usersWithPushEnabled} / ${push.totalLpUsers}` : "—"} />
        <StatCard
          label="Push service"
          value={push ? (pushReady ? "Ready" : "Off") : "—"}
          note={push && !pushReady ? "Server push keys are not configured" : undefined}
          noteTone="danger"
        />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="New notice" aside="Appears in the client’s Notices screen">
          <div className="flex flex-col gap-4">
            <Segmented
              label="Audience"
              value={target}
              onChange={setTarget}
              options={[
                { value: "all", label: "All clients" },
                { value: "user", label: "One client" },
              ]}
            />
            {target === "user" && (
              <SelectField
                label="Client"
                value={userId}
                onChange={setUserId}
                options={[{ value: "", label: "Select a client" }, ...users.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.email}` }))]}
              />
            )}
            <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            <TextArea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} />
            <Checkbox checked={alsoPush && pushReady} onChange={setAlsoPush}>
              {pushReady ? "Also send as a push notification" : "Push notifications unavailable (not configured on the server)"}
            </Checkbox>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Btn loading={busy} onClick={send} className="self-end">
              Publish notice
            </Btn>
          </div>
        </Panel>

        <Panel title="Published notices" aside={<SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search notices" />}>
          {notices === null ? (
            <Loading />
          ) : shown.length === 0 ? (
            <Empty title="No notices yet" body="Announcements you publish appear here with how many clients have read them." />
          ) : (
            <>
              <Rows>
                {shown.slice((current - 1) * PAGE, current * PAGE).map((n) => (
                  <li key={n.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-sfx-text">{n.title}</p>
                        <p className="mt-0.5 text-[12px] text-sfx-muted">
                          {ago(n.createdAt)} • {n.readCount} read{n.readCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Pill status={n.target === "all" ? "approved" : "pending"} label={n.target === "all" ? "All clients" : n.targetUser?.fullName || "One client"} />
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-[13px] text-sfx-text/80">{n.message}</p>
                  </li>
                ))}
              </Rows>
              <div className="mt-4">
                <Pager page={current} pages={pages} onPage={setPage} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <OpsNote>Notices can’t be edited or withdrawn once published. Push reaches only clients who turned notifications on in the app.</OpsNote>
    </>
  );
}
