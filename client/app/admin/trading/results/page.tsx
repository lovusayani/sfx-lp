"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Btn, DetailList, Dialog, Empty, exportCsv, ExportLink, Loading, money, OpsNote, Panel, Pill, Row, Rows } from "@/components/admin/ui";
import { Pager, Segmented } from "@/components/sfx/kit";
import { Alert, Field, SelectField } from "@/components/sfx/ui";
import {
  AdminLpUser,
  AdminTradeLogListResponse,
  createAdminTradeLog,
  getAdminTradeLogs,
  getAllLpUsers,
} from "@/services/admin.service";

const DEFAULT_PAIRS = ["USD/INR", "JPY/USD", "XAP/CZH", "EUR/USD", "GBP/USD"];
const PAIRS_KEY = "admin_trade_pairs";
const PAIR_RE = /^[A-Z]{2,10}\/[A-Z]{2,10}$/;
const LIMIT = 10;

const readPairs = () => {
  try {
    const raw = window.localStorage.getItem(PAIRS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      const ok = parsed.filter((p): p is string => typeof p === "string" && PAIR_RE.test(p));
      if (ok.length) return ok;
    }
  } catch {
    // storage unavailable
  }
  return DEFAULT_PAIRS;
};
const savePairs = (pairs: string[]) => {
  try {
    window.localStorage.setItem(PAIRS_KEY, JSON.stringify(pairs));
  } catch {
    // storage unavailable
  }
};

type Calc = { pnl: number; result: number; rest: number; after: number };

/** Trading → Trade results: post a profit/loss result to a client's Trade wallet. */
export default function AdminTradeResultsPage() {
  const [users, setUsers] = useState<AdminLpUser[] | null>(null);
  const [logs, setLogs] = useState<AdminTradeLogListResponse | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [pairs, setPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [pairsOpen, setPairsOpen] = useState(false);

  const [userId, setUserId] = useState("");
  const [pair, setPair] = useState("");
  const [amount, setAmount] = useState("");
  const [margin, setMargin] = useState("");
  const [type, setType] = useState<"profit" | "loss">("profit");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => alive && setPairs(readPairs()));
    getAllLpUsers().then(
      (u) => alive && setUsers(u),
      (e) => alive && (setUsers([]), setError(e instanceof Error ? e.message : "Couldn’t load clients."))
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    getAdminTradeLogs(logPage, LIMIT).then(
      (l) => alive && setLogs(l),
      (e) => alive && setError(e instanceof Error ? e.message : "Couldn’t load trade results.")
    );
    return () => {
      alive = false;
    };
  }, [logPage, reload]);

  const active = useMemo(() => (users || []).filter((u) => u.status === "active"), [users]);
  const user = active.find((u) => u.id === userId);
  const balance = Number(user?.tradeWalletBalance || 0);

  const calc: Calc | null = useMemo(() => {
    const v = Number(amount);
    const m = Number(margin);
    if (!user || !amount || !margin || !Number.isFinite(v) || !Number.isFinite(m) || v <= 0 || m < 0 || v > balance) return null;
    const pnl = (v * m) / 100;
    const result = type === "profit" ? v + pnl : Math.max(v - pnl, 0);
    const rest = Math.max(balance - v, 0);
    return { pnl, result, rest, after: result + rest };
  }, [amount, margin, type, user, balance]);

  const problem = !user
    ? ""
    : balance <= 0
      ? "This client has no Trade wallet balance."
      : Number(amount) > balance
        ? `Trade value can’t exceed the Trade wallet (${money(balance)}).`
        : "";

  const reset = () => {
    setPair("");
    setAmount("");
    setMargin("");
    setType("profit");
  };

  const submit = async () => {
    if (!user || !calc || !pair) return setMsg({ tone: "danger", text: "Choose a client and pair, then enter the trade value and margin." });
    setSaving(true);
    setMsg(null);
    try {
      await createAdminTradeLog({ lpUserId: user.id, tradePair: pair, tradeVal: Number(amount), tradeType: type, margin: Number(margin) });
      setMsg({ tone: "success", text: `Posted ${type} of ${money(calc.pnl)} to ${user.fullName}. Trade wallet is now ${money(calc.after)}.` });
      reset();
      setLogPage(1);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Couldn’t post the trade result." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {error && <Alert className="mb-4">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title="Post a trade result" aside="Credits or debits the Trade wallet">
          {users === null ? (
            <Loading rows={3} />
          ) : (
            <div className="flex flex-col gap-4">
              <SelectField
                label="Client"
                value={userId}
                onChange={(v) => (setUserId(v), setMsg(null))}
                options={[{ value: "", label: "Select a client" }, ...active.map((u) => ({ value: u.id, label: `${u.fullName} · ${money(u.tradeWalletBalance)}` }))]}
              />
              <div className="flex items-end gap-2">
                <SelectField
                  className="flex-1"
                  label="Trade pair"
                  value={pair}
                  onChange={setPair}
                  options={[{ value: "", label: "Select a pair" }, ...pairs.map((p) => ({ value: p, label: p }))]}
                />
                <Btn variant="secondary" onClick={() => setPairsOpen(true)} className="h-[46px]">
                  Edit pairs
                </Btn>
              </div>
              <Segmented
                label="Result"
                value={type}
                onChange={setType}
                options={[
                  { value: "profit", label: "Profit" },
                  { value: "loss", label: "Loss" },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Trade value (USDT)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} error={problem || undefined} />
                <Field label="Margin %" type="number" min="0" step="0.01" value={margin} onChange={(e) => setMargin(e.target.value)} />
              </div>

              {user && (
                <DetailList
                  items={[
                    ["Trade wallet now", money(balance)],
                    [type === "profit" ? "Profit" : "Loss", calc ? <span className={type === "profit" ? "text-sfx-success" : "text-sfx-danger"}>{money(calc.pnl)}</span> : "—"],
                    ["Trade result", calc ? money(calc.result) : "—"],
                    ["Untouched balance", calc ? money(calc.rest) : "—"],
                    ["Trade wallet after", calc ? <strong className="text-sfx-gold">{money(calc.after)}</strong> : "—"],
                  ]}
                />
              )}

              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

              <div className="flex justify-end gap-2">
                <Btn variant="ghost" onClick={reset}>
                  Clear
                </Btn>
                <Btn loading={saving} disabled={!calc || !pair} onClick={submit}>
                  Post result
                </Btn>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent trade results"
          aside={
            <ExportLink
              onClick={() =>
                logs &&
                exportCsv(
                  "trade-results.csv",
                  logs.records.map((r) => ({
                    trade_id: r.trade_id,
                    client: r.LP_name,
                    date: r.trade_date,
                    time: r.trade_time,
                    pair: r.trade_pair,
                    value: r.trade_val,
                    type: r.trade_type,
                    margin_pct: r.margin,
                    pnl: r.profit,
                    before: r.old_trade_bal,
                    after: r.curr_trade_bal,
                  }))
                )
              }
            />
          }
        >
          {!logs ? (
            <Loading />
          ) : logs.records.length === 0 ? (
            <Empty title="No trade results yet" body="Results you post appear here and in the client’s Performance screen." />
          ) : (
            <>
              <Rows>
                {logs.records.map((r) => (
                  <Row
                    key={r.id}
                    title={`${r.trade_pair} · ${r.LP_name}`}
                    sub={`${r.trade_id} • ${r.trade_date} ${r.trade_time}`}
                    middle={
                      <span className={r.trade_type === "profit" ? "text-sfx-success" : "text-sfx-danger"}>
                        {r.trade_type === "profit" ? "+" : "−"}
                        {money(Math.abs(r.profit))}
                      </span>
                    }
                    middleSub={`${money(r.trade_val)} at ${Number(r.margin).toFixed(2)}% · ${money(r.old_trade_bal)} → ${money(r.curr_trade_bal)}`}
                    status={<Pill status={r.trade_type === "profit" ? "approved" : "rejected"} label={r.trade_type === "profit" ? "Profit" : "Loss"} />}
                  />
                ))}
              </Rows>
              <div className="mt-4">
                <Pager page={logs.page} pages={Math.max(1, logs.totalPages)} onPage={setLogPage} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <OpsNote>Posting a result changes the client’s Trade wallet immediately and can’t be undone from here. Check the client and amounts before posting.</OpsNote>

      {pairsOpen && (
        <PairsDialog
          pairs={pairs}
          onClose={() => setPairsOpen(false)}
          onSave={(next) => {
            setPairs(next);
            savePairs(next);
            if (pair && !next.includes(pair)) setPair("");
          }}
        />
      )}
    </>
  );
}

function PairsDialog({ pairs, onClose, onSave }: { pairs: string[]; onClose: () => void; onSave: (p: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const add = () => {
    const p = draft.trim().toUpperCase().replace(/\s+/g, "");
    if (!PAIR_RE.test(p)) return setErr("Use the format ABC/XYZ.");
    if (pairs.includes(p)) return setErr("That pair is already listed.");
    onSave([...pairs, p]);
    setDraft("");
    setErr("");
  };
  return (
    <Dialog open onClose={onClose} title="Trade pairs">
      <p className="mb-4 text-[13px] text-sfx-muted">Pairs are saved in this browser for quick selection.</p>
      <ul className="mb-4 flex flex-wrap gap-2">
        {pairs.map((p) => (
          <li key={p} className="inline-flex h-[34px] items-center gap-1.5 rounded-[12px] bg-sfx-surface-2 pl-3 pr-1.5 text-[13px] text-sfx-text">
            {p}
            <button
              type="button"
              aria-label={`Remove ${p}`}
              disabled={pairs.length <= 1}
              onClick={() => onSave(pairs.filter((x) => x !== p))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-sfx-muted hover:text-sfx-danger disabled:opacity-30"
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field className="flex-1" label="New pair" placeholder="EUR/USD" value={draft} onChange={(e) => setDraft(e.target.value)} error={err || undefined} />
        <Btn type="submit" className="mb-[1px] h-[46px]" aria-label="Add pair">
          <Plus size={16} /> Add
        </Btn>
      </form>
    </Dialog>
  );
}
