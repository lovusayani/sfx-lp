"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Btn, Dialog, Empty, Loading, money, Panel, Rows } from "@/components/admin/ui";
import { Alert, Field, SelectField } from "@/components/sfx/ui";
import {
  AdminLpUser,
  backfillAdminCharges,
  ChargeSettings,
  deleteAdminOrderCharges,
  deleteAdminSymbolCharge,
  deleteAdminUserGlobalCharge,
  deleteAdminUserSymbolCharge,
  getAdminChargeSettings,
  getAllLpUsers,
  setAdminGlobalCharge,
  setAdminSymbolCharge,
  setAdminUserGlobalCharge,
  setAdminUserSymbolCharge,
} from "@/services/admin.service";

const LOT_CLASSES = [
  { size: "1.00", label: "Standard" },
  { size: "0.10", label: "Mini" },
  { size: "0.01", label: "Micro" },
  { size: "0.001", label: "Nano" },
];
type Msg = { tone: "success" | "danger"; text: string } | null;
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const validRate = (s: string) => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;

/** Trading → Charges: per-lot charge rates (global, per symbol, per client). */
export default function AdminChargesPage() {
  const [settings, setSettings] = useState<ChargeSettings | null>(null);
  const [users, setUsers] = useState<AdminLpUser[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [globalDraft, setGlobalDraft] = useState("");
  const [symbol, setSymbol] = useState("");
  const [symbolRate, setSymbolRate] = useState("");
  const [ovUser, setOvUser] = useState("");
  const [ovSymbol, setOvSymbol] = useState("");
  const [ovRate, setOvRate] = useState("");
  const [confirm, setConfirm] = useState<null | "backfill" | "delete">(null);

  const fetchAll = () => Promise.all([getAdminChargeSettings(), getAllLpUsers()]);
  const apply = ([s, u]: [ChargeSettings, AdminLpUser[]]) => {
    setSettings(s);
    setUsers(u);
    setGlobalDraft(String(s.global ?? 0));
  };
  const reload = () => fetchAll().then(apply, (e) => setError(errText(e, "Couldn’t load charge settings.")));

  useEffect(() => {
    let alive = true;
    fetchAll().then(
      (r) => alive && apply(r),
      (e) => alive && setError(errText(e, "Couldn’t load charge settings."))
    );
    return () => {
      alive = false;
    };
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ tone: "success", text: ok });
      return true;
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "That didn’t work. Try again.") });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return error ? <Alert>{error}</Alert> : <Loading rows={4} />;

  const userName = (id: string) => users.find((u) => u.id === id)?.fullName || "Client";

  return (
    <>
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Default charge" aside="Per standard lot (1.00)">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validRate(globalDraft)) return setMsg({ tone: "danger", text: "Enter a charge of 0 or more." });
              run("global", () => setAdminGlobalCharge(Number(globalDraft)), "Default charge saved.");
            }}
          >
            <Field className="flex-1" label="USD per standard lot" type="number" min="0" step="0.01" value={globalDraft} onChange={(e) => setGlobalDraft(e.target.value)} />
            <Btn type="submit" loading={busy === "global"} className="h-[46px]">
              Save
            </Btn>
          </form>
          <p className="mt-4 text-[12px] text-sfx-muted">Smaller lots are charged pro-rata:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LOT_CLASSES.map((l) => (
              <span key={l.label} className="rounded-[10px] bg-sfx-surface-2 px-2.5 py-1 text-[12px] text-sfx-text">
                {l.size} {l.label} = {money(settings.global * Number(l.size), 3)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Maintenance" aside="Affects stored orders">
          <div className="flex flex-col gap-3 text-[13px] text-sfx-muted">
            <p>Recalculate charges on every imported order with today’s rates, or delete charge records for a date range.</p>
            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" onClick={() => setConfirm("backfill")}>
                Recalculate all orders
              </Btn>
              <Btn variant="danger" onClick={() => setConfirm("delete")}>
                Delete charges by date
              </Btn>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Symbol rates" aside="Override the default for one symbol">
          <form
            className="mb-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const s = symbol.trim().toUpperCase();
              if (!s || !validRate(symbolRate)) return setMsg({ tone: "danger", text: "Enter a symbol and a charge of 0 or more." });
              if (await run("symbol", () => setAdminSymbolCharge(s, Number(symbolRate)), `${s} rate saved.`)) {
                setSymbol("");
                setSymbolRate("");
              }
            }}
          >
            <Field label="Symbol" placeholder="XAUUSD" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            <Field label="USD / std lot" type="number" min="0" step="0.01" value={symbolRate} onChange={(e) => setSymbolRate(e.target.value)} />
            <Btn type="submit" loading={busy === "symbol"} className="h-[46px]">
              Save
            </Btn>
          </form>
          {settings.symbols.length === 0 ? (
            <Empty title="No symbol rates" body="Every symbol uses the default charge." />
          ) : (
            <Rows>
              {settings.symbols.map((s) => (
                <RateRow
                  key={s.symbol}
                  title={s.symbol}
                  value={s.chargePerStandardLot}
                  busy={busy === `sym-${s.symbol}`}
                  onDelete={() => run(`sym-${s.symbol}`, () => deleteAdminSymbolCharge(s.symbol), `${s.symbol} now uses the default.`)}
                />
              ))}
            </Rows>
          )}
        </Panel>

        <Panel title="Client rates" aside="Override for one client">
          <form
            className="mb-3 grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const s = ovSymbol.trim().toUpperCase();
              if (!ovUser || !validRate(ovRate)) return setMsg({ tone: "danger", text: "Choose a client and enter a charge of 0 or more." });
              const ok = await run(
                "override",
                () => (s ? setAdminUserSymbolCharge(ovUser, s, Number(ovRate)) : setAdminUserGlobalCharge(ovUser, Number(ovRate))),
                `Rate saved for ${userName(ovUser)}.`
              );
              if (ok) {
                setOvSymbol("");
                setOvRate("");
              }
            }}
          >
            <SelectField label="Client" value={ovUser} onChange={setOvUser} options={[{ value: "", label: "Select" }, ...users.map((u) => ({ value: u.id, label: u.fullName }))]} />
            <Field label="Symbol (blank = all)" placeholder="All" value={ovSymbol} onChange={(e) => setOvSymbol(e.target.value)} />
            <Field label="USD / std lot" type="number" min="0" step="0.01" value={ovRate} onChange={(e) => setOvRate(e.target.value)} />
            <Btn type="submit" loading={busy === "override"} className="h-[46px]">
              Save
            </Btn>
          </form>
          {settings.userOverrides.length === 0 ? (
            <Empty title="No client rates" body="All clients use the default and symbol rates." />
          ) : (
            <Rows>
              {settings.userOverrides.flatMap((o) => [
                ...(o.global !== null
                  ? [
                      <RateRow
                        key={`${o.userId}-all`}
                        title={o.fullName}
                        sub={`${o.email} • all symbols`}
                        value={o.global}
                        busy={busy === `ov-${o.userId}`}
                        onDelete={() => run(`ov-${o.userId}`, () => deleteAdminUserGlobalCharge(o.userId), `Removed ${o.fullName}’s rate.`)}
                      />,
                    ]
                  : []),
                ...o.symbols.map((s) => (
                  <RateRow
                    key={`${o.userId}-${s.symbol}`}
                    title={o.fullName}
                    sub={`${o.email} • ${s.symbol}`}
                    value={s.chargePerStandardLot}
                    busy={busy === `ov-${o.userId}-${s.symbol}`}
                    onDelete={() => run(`ov-${o.userId}-${s.symbol}`, () => deleteAdminUserSymbolCharge(o.userId, s.symbol), `Removed ${o.fullName}’s ${s.symbol} rate.`)}
                  />
                )),
              ])}
            </Rows>
          )}
        </Panel>
      </div>

      {confirm === "backfill" && (
        <ConfirmBackfill
          onClose={() => setConfirm(null)}
          onDone={(t) => (setConfirm(null), setMsg({ tone: "success", text: t }))}
        />
      )}
      {confirm === "delete" && (
        <ConfirmDelete
          onClose={() => setConfirm(null)}
          onDone={(t) => (setConfirm(null), setMsg({ tone: "success", text: t }))}
        />
      )}
    </>
  );
}

function RateRow({ title, sub, value, busy, onDelete }: { title: string; sub?: string; value: number; busy: boolean; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-sfx-text">{title}</p>
        {sub && <p className="truncate text-[12px] text-sfx-muted">{sub}</p>}
      </div>
      <span className="text-[14px] tabular-nums text-sfx-gold">{money(value)}</span>
      <Btn variant="ghost" loading={busy} onClick={onDelete} aria-label={`Remove ${title} rate`} className="h-9 px-2">
        {!busy && <Trash2 size={15} />}
      </Btn>
    </li>
  );
}

function ConfirmBackfill({ onClose, onDone }: { onClose: () => void; onDone: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Recalculate all orders?"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                const r = await backfillAdminCharges();
                onDone(`Recalculated ${r.processed} orders from ${r.sources} source${r.sources === 1 ? "" : "s"}.`);
              } catch (e) {
                setErr(errText(e, "Recalculation failed."));
                setBusy(false);
              }
            }}
          >
            Recalculate
          </Btn>
        </>
      }
    >
      <p className="text-[14px] text-sfx-muted">Every imported order is charged again with the current rates. Existing charge amounts will change.</p>
      {err && <Alert className="mt-4">{err}</Alert>}
    </Dialog>
  );
}

function ConfirmDelete({ onClose, onDone }: { onClose: () => void; onDone: (t: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete charge records"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!from) return setErr("Choose a start date.");
              if (to && to < from) return setErr("End date must be after the start date.");
              setBusy(true);
              setErr("");
              try {
                const r = await deleteAdminOrderCharges(from, to || undefined);
                onDone(`Deleted ${r.deletedCount} charge record${r.deletedCount === 1 ? "" : "s"}.`);
              } catch (e) {
                setErr(errText(e, "Delete failed."));
                setBusy(false);
              }
            }}
          >
            Delete
          </Btn>
        </>
      }
    >
      <p className="mb-4 text-[14px] text-sfx-muted">Removes charge records for orders in this range. This can’t be undone.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To (optional)" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {err && <Alert className="mt-4">{err}</Alert>}
    </Dialog>
  );
}
