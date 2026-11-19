"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Btn, DetailList, Dialog, Empty, Loading, OpsNote, Panel, Pill, Row, Rows } from "@/components/admin/ui";
import { Segmented } from "@/components/sfx/kit";
import { Alert, Checkbox, Field } from "@/components/sfx/ui";
import {
  AdminLpUser,
  ApiSourceRecord,
  createAdminApiSource,
  deleteAdminApiSource,
  getAdminApiSources,
  getAllLpUsers,
  setAdminApiSourceUsers,
  updateAdminApiSource,
} from "@/services/admin.service";

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Trading → API sources: broker feeds that supply client orders. */
export default function AdminApiSourcesPage() {
  const [sources, setSources] = useState<ApiSourceRecord[] | null>(null);
  const [users, setUsers] = useState<AdminLpUser[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAll = () => Promise.all([getAdminApiSources(), getAllLpUsers()]);
  const apply = ([s, u]: [ApiSourceRecord[], AdminLpUser[]]) => {
    setSources(s);
    setUsers(u);
  };
  const reload = () => fetchAll().then(apply, (e) => setError(errText(e, "Couldn’t load API sources.")));

  useEffect(() => {
    let alive = true;
    fetchAll().then(
      (r) => alive && apply(r),
      (e) => alive && (setSources([]), setError(errText(e, "Couldn’t load API sources.")))
    );
    return () => {
      alive = false;
    };
  }, []);

  const selected = sources?.find((s) => s.id === selectedId) || null;

  return (
    <>
      {error && <Alert className="mb-4">{error}</Alert>}
      <Panel
        title="Connected sources"
        aside={
          <Btn onClick={() => setAdding(true)} className="h-[34px] rounded-[12px]">
            <Plus size={15} /> Add source
          </Btn>
        }
      >
        {sources === null ? (
          <Loading />
        ) : sources.length === 0 ? (
          <Empty title="No API sources yet" body="Add a broker API to import client orders into the Trade screen and the order report." />
        ) : (
          <Rows>
            {sources.map((s) => (
              <Row
                key={s.id}
                title={s.name}
                sub={s.baseUrl}
                middle={`${s.assignedUsers.length} client${s.assignedUsers.length === 1 ? "" : "s"}`}
                middleSub={`Key ${s.apiKeyMasked} · ${s.authHeader === "bearer" ? "Bearer" : "x-api-key"}`}
                status={<Pill status={s.isActive ? "active" : "inactive"} />}
                onView={() => setSelectedId(s.id)}
                viewLabel="Manage"
              />
            ))}
          </Rows>
        )}
      </Panel>

      <OpsNote>API keys are stored on the server and never shown in full. Only clients assigned to a source see its orders.</OpsNote>

      {adding && <AddSourceDialog onClose={() => setAdding(false)} onCreated={() => (setAdding(false), reload())} />}
      {selected && <SourceDialog source={selected} users={users} onClose={() => setSelectedId(null)} onChanged={reload} />}
    </>
  );
}

function AddSourceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authHeader, setAuthHeader] = useState<"x-api-key" | "bearer">("x-api-key");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim() || !apiKey.trim()) return setErr("Name and API key are required.");
    try {
      new URL(baseUrl.trim());
    } catch {
      return setErr("Enter the full base URL, starting with https://");
    }
    setBusy(true);
    setErr("");
    try {
      await createAdminApiSource({ name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), authHeader });
      onCreated();
    } catch (e) {
      setErr(errText(e, "Couldn’t add the source."));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add API source"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn loading={busy} onClick={submit}>
            Add source
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Broker A" autoComplete="off" />
        <Field label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" autoComplete="off" />
        <Field label="API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" />
        <Segmented
          label="Auth header"
          value={authHeader}
          onChange={setAuthHeader}
          options={[
            { value: "x-api-key", label: "x-api-key" },
            { value: "bearer", label: "Bearer token" },
          ]}
        />
        {err && <Alert>{err}</Alert>}
      </div>
    </Dialog>
  );
}

function SourceDialog({ source, users, onClose, onChanged }: { source: ApiSourceRecord; users: AdminLpUser[]; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const [assigned, setAssigned] = useState<string[]>(source.assignedUsers.map((u) => u.id));
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await onChanged();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "That didn’t work.") });
    } finally {
      setBusy(null);
    }
  };

  const q = filter.trim().toLowerCase();
  const list = users.filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q));
  const dirty = assigned.slice().sort().join() !== source.assignedUsers.map((u) => u.id).sort().join();

  return (
    <Dialog
      open
      onClose={onClose}
      title={source.name}
      wide
      footer={
        <>
          {confirmDelete ? (
            <>
              <span className="mr-auto self-center text-[13px] text-sfx-danger">Delete this source permanently?</span>
              <Btn variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </Btn>
              <Btn
                variant="danger"
                loading={busy === "delete"}
                onClick={async () => {
                  setBusy("delete");
                  try {
                    await deleteAdminApiSource(source.id);
                    onClose();
                    await onChanged();
                  } catch (e) {
                    setMsg({ tone: "danger", text: errText(e, "Couldn’t delete the source.") });
                    setBusy(null);
                  }
                }}
              >
                Delete
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="danger" onClick={() => setConfirmDelete(true)} className="mr-auto">
                Delete source
              </Btn>
              <Btn
                variant="secondary"
                loading={busy === "toggle"}
                onClick={() =>
                  act("toggle", () => updateAdminApiSource(source.id, { isActive: !source.isActive }), source.isActive ? "Source paused." : "Source activated.")
                }
              >
                {source.isActive ? "Pause" : "Activate"}
              </Btn>
              <Btn loading={busy === "users"} disabled={!dirty} onClick={() => act("users", () => setAdminApiSourceUsers(source.id, assigned), "Client access saved.")}>
                Save clients
              </Btn>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Pill status={source.isActive ? "active" : "inactive"} />
          <DetailList
            items={[
              ["Base URL", <span key="u" className="font-mono text-[12px]">{source.baseUrl}</span>],
              ["API key", source.apiKeyMasked],
              ["Auth header", source.authHeader === "bearer" ? "Authorization: Bearer" : "x-api-key"],
              ["Added", source.createdAt ? new Date(source.createdAt).toLocaleDateString("en-GB") : "—"],
            ]}
          />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-sfx-text">
            Clients with access <span className="text-sfx-muted">({assigned.length})</span>
          </p>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter clients"
            aria-label="Filter clients"
            className="h-[38px] rounded-[12px] border border-sfx-line bg-sfx-field px-3 text-[13px] text-sfx-text placeholder:text-sfx-muted/70 focus:border-sfx-gold focus:outline-none"
          />
          <div className="max-h-[280px] overflow-y-auto rounded-[14px] border border-sfx-line px-3 py-1">
            {list.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-sfx-muted">No clients</p>
            ) : (
              list.map((u) => (
                <div key={u.id} className="py-2">
                  <Checkbox
                    checked={assigned.includes(u.id)}
                    onChange={(on) => setAssigned((a) => (on ? [...a, u.id] : a.filter((x) => x !== u.id)))}
                  >
                    <span className="text-sfx-text">{u.fullName}</span> <span className="text-sfx-muted">· {u.email}</span>
                  </Checkbox>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {msg && <Alert tone={msg.tone} className="mt-4">{msg.text}</Alert>}
    </Dialog>
  );
}
