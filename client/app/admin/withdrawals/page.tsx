"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import {
  ago,
  Btn,
  compactMoney,
  DetailList,
  Dialog,
  Empty,
  exportCsv,
  ExportLink,
  FilterChips,
  Loading,
  money,
  OpsNote,
  PageHeader,
  Panel,
  Pill,
  Row,
  Rows,
  SearchBox,
  StatCard,
  StatGrid,
} from "@/components/admin/ui";
import { Pager, TextArea } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import {
  AdminWithdrawMethodRecord,
  AdminWithdrawRequestRecord,
  getAdminWithdrawMethods,
  getAdminWithdrawRequests,
  reviewAdminWithdrawRequest,
} from "@/services/admin.service";

type Filter = "open" | "approved" | "closed" | "all" | "wallets";
const PAGE = 12;
const isOpen = (s: string) => s === "pending" || s === "processing";
const short = (a: string) => (a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);
const sameMonth = (iso?: string) => {
  if (!iso) return false;
  const a = new Date(iso);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
};

/** Figma: ADMIN / Withdrawals. Approve payouts from the Main wallet. */
export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<AdminWithdrawRequestRecord[] | null>(null);
  const [methods, setMethods] = useState<AdminWithdrawMethodRecord[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAll = () => Promise.allSettled([getAdminWithdrawRequests(), getAdminWithdrawMethods()]);
  const apply = ([r, m]: Awaited<ReturnType<typeof fetchAll>>) => {
    setRequests(r.status === "fulfilled" ? r.value : []);
    setMethods(m.status === "fulfilled" ? m.value : []);
    if (r.status === "rejected") setError(r.reason instanceof Error ? r.reason.message : "Couldn’t load withdrawals.");
  };
  const load = () => fetchAll().then(apply);

  useEffect(() => {
    let alive = true;
    fetchAll().then((res) => alive && apply(res));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => requests || [], [requests]);
  const open = list.filter((w) => isOpen(w.status));
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      list
        .filter((w) =>
          filter === "open" ? isOpen(w.status) : filter === "approved" ? w.status === "approved" : filter === "closed" ? ["rejected", "cancelled"].includes(w.status) : true
        )
        .filter((w) => !q || `${w.user.fullName} ${w.user.email} ${w.txId} ${w.walletAddress}`.toLowerCase().includes(q)),
    [list, filter, q]
  );
  const shownMethods = methods.filter((m) => !q || `${m.fullName} ${m.email} ${m.walletAddress}`.toLowerCase().includes(q));
  const count = filter === "wallets" ? shownMethods.length : shown.length;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const current = Math.min(page, pages);
  const selected = list.find((w) => w.id === selectedId) || null;

  return (
    <>
      <PageHeader title="Withdrawals" />

      <StatGrid>
        <StatCard label="Pending payouts" value={requests ? compactMoney(open.reduce((a, w) => a + w.amount, 0)) : "—"} />
        <StatCard
          label="Paid this month"
          value={requests ? compactMoney(list.filter((w) => w.status === "approved" && sameMonth(w.reviewedAt || w.createdAt)).reduce((a, w) => a + w.amount, 0)) : "—"}
        />
        <StatCard label="Awaiting approval" value={requests ? open.length : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Panel
        title={filter === "wallets" ? "Payout wallets" : "Withdrawals activity"}
        aside={
          <>
            <SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search client, TX or address" />
            <ExportLink
              onClick={() =>
                filter === "wallets"
                  ? exportCsv(
                      "payout-wallets.csv",
                      shownMethods.map((m) => ({ client: m.fullName, email: m.email, network: m.chainType, currency: m.currency, address: m.walletAddress, main_wallet: m.mainWalletBalance }))
                    )
                  : exportCsv(
                      "withdrawals.csv",
                      shown.map((w) => ({
                        tx: w.txId,
                        client: w.user.fullName,
                        email: w.user.email,
                        amount: w.amount,
                        currency: w.currency,
                        network: w.chainType,
                        address: w.walletAddress,
                        status: w.status,
                        requested: w.createdAt || "",
                        reviewed: w.reviewedAt || "",
                        admin_remark: w.adminRemark || "",
                      }))
                    )
              }
            />
          </>
        }
      >
        <FilterChips
          value={filter}
          onChange={(v) => (setFilter(v), setPage(1))}
          options={[
            { value: "open", label: "Pending", count: requests ? open.length : undefined },
            { value: "approved", label: "Paid" },
            { value: "closed", label: "Rejected" },
            { value: "all", label: "All" },
            { value: "wallets", label: "Payout wallets" },
          ]}
        />
        {requests === null ? (
          <Loading />
        ) : filter === "wallets" ? (
          shownMethods.length === 0 ? (
            <Empty title="No payout wallets yet" body="Clients add their payout wallet on the Withdraw screen." />
          ) : (
            <Rows>
              {shownMethods.slice((current - 1) * PAGE, current * PAGE).map((m) => (
                <Row
                  key={m.id}
                  title={m.fullName}
                  sub={m.email}
                  middle={<span className="font-mono text-[13px]">{short(m.walletAddress)}</span>}
                  middleSub={`${m.currency} · ${m.chainType}`}
                  status={<span className="text-[14px] tabular-nums text-sfx-text">{money(m.mainWalletBalance)}</span>}
                />
              ))}
            </Rows>
          )
        ) : shown.length === 0 ? (
          <Empty title={filter === "open" ? "No payouts waiting" : "Nothing here"} body="Client withdrawal requests appear here." />
        ) : (
          <Rows>
            {shown.slice((current - 1) * PAGE, current * PAGE).map((w) => (
              <Row
                key={w.id}
                title={w.txId}
                sub={`${w.user.fullName} • ${w.currency} ${w.chainType}`}
                middle={money(w.amount)}
                middleSub={ago(w.createdAt)}
                status={<Pill status={w.status} />}
                onView={() => setSelectedId(w.id)}
              />
            ))}
          </Rows>
        )}
        {requests !== null && count > 0 && (
          <div className="mt-4">
            <Pager page={current} pages={pages} onPage={setPage} />
          </div>
        )}
      </Panel>

      <OpsNote>Send the payout from the company wallet first, then approve here. Rejecting returns the amount to the client’s Main wallet.</OpsNote>

      {selected && <WithdrawalDialog w={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
    </>
  );
}

function WithdrawalDialog({ w, onClose, onChanged }: { w: AdminWithdrawRequestRecord; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const [remark, setRemark] = useState(w.adminRemark || "");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const open = isOpen(w.status);

  const decide = async (status: "approved" | "rejected") => {
    if (status === "rejected" && !remark.trim()) return setMsg({ tone: "danger", text: "Add a short reason for the client." });
    setBusy(status);
    setMsg(null);
    try {
      const r = await reviewAdminWithdrawRequest(w.id, status, remark.trim() || undefined);
      await onChanged();
      setMsg({ tone: "success", text: r.message || (status === "approved" ? "Marked as paid." : "Request rejected.") });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Couldn’t update the request." });
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(w.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — address is selectable
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${w.txId} · ${money(w.amount)}`}
      footer={
        open ? (
          <>
            <Btn variant="danger" loading={busy === "rejected"} onClick={() => decide("rejected")}>
              Reject
            </Btn>
            <Btn loading={busy === "approved"} onClick={() => decide("approved")}>
              Mark as paid
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onClick={onClose}>
            Close
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Pill status={w.status} />
        <DetailList
          items={[
            ["Client", w.user.fullName],
            ["Email", w.user.email],
            ["Amount", `${money(w.amount)} ${w.currency}`],
            ["Network", w.chainType],
            ["Requested", w.createdAt ? new Date(w.createdAt).toLocaleString("en-GB") : "—"],
            ...(w.reviewedAt ? ([["Reviewed", new Date(w.reviewedAt).toLocaleString("en-GB")]] as Array<[string, React.ReactNode]>) : []),
            ["Main wallet now", money(w.user.mainWalletBalance)],
          ]}
        />
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">Pay to address</p>
          <div className="flex items-center gap-2 rounded-[14px] border border-sfx-line bg-sfx-field px-4 py-3">
            <code className="min-w-0 flex-1 break-all text-[13px] text-sfx-text">{w.walletAddress}</code>
            <button type="button" onClick={copy} aria-label="Copy address" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sfx-gold hover:bg-sfx-gold-soft/50">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        {open ? (
          <TextArea label="Remark to client (required to reject)" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} />
        ) : (
          w.adminRemark && <DetailList items={[["Admin remark", w.adminRemark]]} />
        )}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </div>
    </Dialog>
  );
}
