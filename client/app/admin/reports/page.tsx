"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

import { ago, Btn, Empty, exportCsv, ExportLink, Loading, OpsNote, PageHeader, Panel, Rows, SearchBox, StatCard, StatGrid } from "@/components/admin/ui";
import { Pager } from "@/components/sfx/kit";
import { Alert, SelectField } from "@/components/sfx/ui";
import { AdminLpUser, deleteAdminPnlUpload, getAdminPnlUploads, getAllLpUsers, PnlUploadRecord, uploadAdminPnlFiles } from "@/services/admin.service";

const PAGE = 12;
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
const errText = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

/** Figma: ADMIN / Reports. P&L statements delivered to each client's Reports screen. */
export default function AdminReportsPage() {
  const [uploads, setUploads] = useState<PnlUploadRecord[] | null>(null);
  const [users, setUsers] = useState<AdminLpUser[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [target, setTarget] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const fetchAll = () => Promise.allSettled([getAdminPnlUploads(), getAllLpUsers()]);
  const apply = ([p, u]: Awaited<ReturnType<typeof fetchAll>>) => {
    setUploads(p.status === "fulfilled" ? p.value : []);
    setUsers(u.status === "fulfilled" ? u.value : []);
    if (p.status === "rejected") setError(errText(p.reason, "Couldn’t load reports."));
  };
  const reload = () => fetchAll().then(apply);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => uploads || [], [uploads]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((u) => !q || `${u.originalName} ${u.targetUserName || ""}`.toLowerCase().includes(q));
  }, [list, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const monthCount = list.filter((u) => {
    const d = new Date(u.uploadedAt);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  }).length;

  const upload = async () => {
    if (!target) return setMsg({ tone: "danger", text: "Choose the client who should receive these reports." });
    if (!files.length) return setMsg({ tone: "danger", text: "Choose at least one PDF." });
    const bad = files.find((f) => !f.name.toLowerCase().endsWith(".pdf"));
    if (bad) return setMsg({ tone: "danger", text: `${bad.name} isn’t a PDF.` });
    setBusy(true);
    setMsg(null);
    try {
      const done = await uploadAdminPnlFiles(files, target);
      setFiles([]);
      if (input.current) input.current.value = "";
      await reload();
      setMsg({ tone: "success", text: `${done.length} report${done.length === 1 ? "" : "s"} sent to ${users.find((u) => u.id === target)?.fullName || "the client"}.` });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Upload failed.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setConfirmId(null);
    try {
      await deleteAdminPnlUpload(id);
      await reload();
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t delete the report.") });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" />

      <StatGrid>
        <StatCard label="Reports delivered" value={uploads ? list.length : "—"} />
        <StatCard label="Sent this month" value={uploads ? monthCount : "—"} />
        <StatCard label="Clients with reports" value={uploads ? new Set(list.map((u) => u.targetUserId).filter(Boolean)).size : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Panel title="Send P&L statements" aside="PDF only">
          <div className="flex flex-col gap-4">
            <SelectField
              label="Client"
              value={target}
              onChange={setTarget}
              options={[{ value: "", label: "Select a client" }, ...users.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.email}` }))]}
            />
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border border-dashed border-sfx-border-strong px-4 py-8 text-center hover:border-sfx-gold">
              <Upload size={20} className="text-sfx-gold" />
              <span className="text-[14px] text-sfx-text">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose PDF files"}</span>
              <span className="text-[12px] text-sfx-muted">Up to 20 at a time</span>
              <input
                ref={input}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 20))}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1 text-[12px] text-sfx-muted">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="flex justify-between gap-3">
                    <span className="truncate text-sfx-text">{f.name}</span>
                    <span className="shrink-0">{size(f.size)}</span>
                  </li>
                ))}
              </ul>
            )}
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Btn loading={busy} onClick={upload} className="self-end">
              Send to client
            </Btn>
          </div>
        </Panel>

        <Panel
          title="Delivered reports"
          aside={
            <>
              <SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search file or client" />
              <ExportLink
                onClick={() =>
                  exportCsv(
                    "pnl-reports.csv",
                    shown.map((u) => ({ file: u.originalName, client: u.targetUserName || "", size_bytes: u.fileSize, uploaded: u.uploadedAt }))
                  )
                }
              />
            </>
          }
        >
          {uploads === null ? (
            <Loading />
          ) : shown.length === 0 ? (
            <Empty title="No reports yet" body="Statements you send appear in the client’s Profile → Reports." />
          ) : (
            <>
              <Rows>
                {shown.slice((current - 1) * PAGE, current * PAGE).map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-sfx-gold-soft text-sfx-gold">
                      <FileText size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-sfx-text">{u.originalName}</p>
                      <p className="truncate text-[12px] text-sfx-muted">
                        {u.targetUserName || "Client"} • {size(u.fileSize)} • {ago(u.uploadedAt)}
                      </p>
                    </div>
                    {confirmId === u.id ? (
                      <div className="flex gap-1.5">
                        <Btn variant="ghost" className="h-9 px-3" onClick={() => setConfirmId(null)}>
                          Keep
                        </Btn>
                        <Btn variant="danger" className="h-9 px-3" onClick={() => remove(u.id)}>
                          Delete
                        </Btn>
                      </div>
                    ) : (
                      <Btn variant="ghost" className="h-9 px-2" loading={deleting === u.id} onClick={() => setConfirmId(u.id)} aria-label={`Delete ${u.originalName}`}>
                        {deleting !== u.id && <Trash2 size={15} />}
                      </Btn>
                    )}
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

      <OpsNote>Each statement is visible only to the client it’s sent to. Deleting removes it from their Reports screen.</OpsNote>
    </>
  );
}
