"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";

import { OpenFileButton, SecureImage } from "@/components/files/SecureFile";
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
  shortId,
  StatCard,
  StatGrid,
} from "@/components/admin/ui";
import { Pager, TextArea } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import { AdminDepositeRecord, getAllAdminDeposites, reviewAdminDeposite } from "@/services/admin.service";

type Filter = "pending" | "approved" | "rejected" | "all";
const PAGE = 12;
const method = (d: AdminDepositeRecord) => (d.depositeType === "on_chain" ? `On-chain · ${d.network || "—"}` : d.depositeType === "f2f" ? "Face to face" : "Buy crypto");
const sameMonth = (iso?: string) => {
  if (!iso) return false;
  const a = new Date(iso);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
};

/** Figma: ADMIN / Deposits. Verify proof of payment and credit the Main wallet. */
export default function AdminDepositsPage() {
  const [records, setRecords] = useState<AdminDepositeRecord[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = () =>
    getAllAdminDeposites().then(setRecords, (e) => {
      setRecords([]);
      setError(e instanceof Error ? e.message : "Couldn’t load deposits.");
    });

  useEffect(() => {
    let alive = true;
    getAllAdminDeposites().then(
      (r) => alive && setRecords(r),
      (e) => {
        if (!alive) return;
        setRecords([]);
        setError(e instanceof Error ? e.message : "Couldn’t load deposits.");
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => records || [], [records]);
  const pending = list.filter((d) => d.status === "pending");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((d) => filter === "all" || d.status === filter)
      .filter((d) => !q || `${d.user.fullName} ${d.user.email} ${shortId("DEP", d.id)}`.toLowerCase().includes(q));
  }, [list, filter, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const selected = list.find((d) => d.id === selectedId) || null;

  return (
    <>
      <PageHeader title="Deposits" />

      <StatGrid>
        <StatCard label="Pending deposits" value={records ? compactMoney(pending.reduce((a, d) => a + d.amount, 0)) : "—"} />
        <StatCard label="Cleared this month" value={records ? compactMoney(list.filter((d) => d.status === "approved" && sameMonth(d.reviewedAt || d.createdAt)).reduce((a, d) => a + d.amount, 0)) : "—"} />
        <StatCard label="Under review" value={records ? pending.length : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Panel
        title="Deposits activity"
        aside={
          <>
            <SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search client or DEP-ID" />
            <ExportLink
              onClick={() =>
                exportCsv(
                  "deposits.csv",
                  shown.map((d) => ({
                    id: shortId("DEP", d.id),
                    client: d.user.fullName,
                    email: d.user.email,
                    amount: d.amount,
                    method: method(d),
                    status: d.status,
                    submitted: d.createdAt || "",
                    reviewed: d.reviewedAt || "",
                    admin_remark: d.adminRemark || "",
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
            { value: "pending", label: "Pending", count: records ? pending.length : undefined },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
        />
        {records === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty title={filter === "pending" ? "No deposits waiting" : "Nothing here"} body="Client deposits appear here with their proof of payment." />
        ) : (
          <>
            <Rows>
              {shown.slice((current - 1) * PAGE, current * PAGE).map((d) => (
                <Row
                  key={d.id}
                  title={shortId("DEP", d.id)}
                  sub={`${d.user.fullName} • ${method(d)}`}
                  middle={money(d.amount)}
                  middleSub={ago(d.createdAt)}
                  status={<Pill status={d.status} />}
                  onView={() => setSelectedId(d.id)}
                />
              ))}
            </Rows>
            <div className="mt-4">
              <Pager page={current} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <OpsNote>Approve only after the funds have arrived in the company wallet. Approval credits the client’s Main wallet immediately.</OpsNote>

      {selected && <DepositDialog d={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
    </>
  );
}

function DepositDialog({ d, onClose, onChanged }: { d: AdminDepositeRecord; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const [remark, setRemark] = useState(d.adminRemark || "");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const open = d.status === "pending";
  const pdf = d.screenshot?.toLowerCase().endsWith(".pdf");

  const decide = async (status: "approved" | "rejected") => {
    if (status === "rejected" && !remark.trim()) return setMsg({ tone: "danger", text: "Add a short reason so the client knows what to fix." });
    setBusy(status);
    setMsg(null);
    try {
      await reviewAdminDeposite(d.id, status, remark.trim() || undefined);
      await onChanged();
      setMsg({ tone: "success", text: status === "approved" ? `${money(d.amount)} credited to ${d.user.fullName}.` : "Deposit rejected." });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Couldn’t update the deposit." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${shortId("DEP", d.id)} · ${money(d.amount)}`}
      wide
      footer={
        open ? (
          <>
            <Btn variant="danger" loading={busy === "rejected"} onClick={() => decide("rejected")}>
              Reject
            </Btn>
            <Btn loading={busy === "approved"} onClick={() => decide("approved")}>
              Approve & credit
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onClick={onClose}>
            Close
          </Btn>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Pill status={d.status} />
          <DetailList
            items={[
              ["Client", d.user.fullName],
              ["Email", d.user.email],
              ["Amount", money(d.amount)],
              ["Method", method(d)],
              ...(d.walletAddress ? ([["Paid to", <span key="w" className="font-mono text-[12px]">{d.walletAddress}</span>]] as Array<[string, React.ReactNode]>) : []),
              ["Submitted", d.createdAt ? new Date(d.createdAt).toLocaleString("en-GB") : "—"],
              ...(d.reviewedAt ? ([["Reviewed", new Date(d.reviewedAt).toLocaleString("en-GB")]] as Array<[string, React.ReactNode]>) : []),
              ["Client note", d.remarks || "—"],
            ]}
          />
          {open ? (
            <TextArea label="Remark to client (required to reject)" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} />
          ) : (
            d.adminRemark && <DetailList items={[["Admin remark", d.adminRemark]]} />
          )}
        </div>
        <figure className="flex flex-col gap-2">
          <figcaption className="text-[13px] font-medium text-sfx-text">Proof of payment</figcaption>
          {!d.screenshot ? (
            <p className="rounded-[16px] border border-sfx-line py-16 text-center text-[13px] text-sfx-muted">No file attached</p>
          ) : pdf ? (
            <OpenFileButton fileRef={d.screenshot} className="inline-flex items-center gap-2 rounded-[16px] border border-sfx-line px-4 py-16 text-[13px] font-semibold text-sfx-gold">
              <FileText size={16} /> Open PDF
            </OpenFileButton>
          ) : (
            <SecureImage fileRef={d.screenshot} alt="Proof of payment" className="max-h-[420px] w-full rounded-[16px] border border-sfx-line bg-black/30 object-contain" />
          )}
        </figure>
      </div>
      {msg && <Alert tone={msg.tone} className="mt-4">{msg.text}</Alert>}
    </Dialog>
  );
}
