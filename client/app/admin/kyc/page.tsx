"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";

import { OpenFileButton, SecureImage } from "@/components/files/SecureFile";
import {
  Btn,
  DetailList,
  Dialog,
  Empty,
  exportCsv,
  ExportLink,
  FilterChips,
  Loading,
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
import { Pager } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import { AdminLpUser, getAllLpUsers, updateLpUserKycStatus } from "@/services/admin.service";

const DOCS = [
  { key: "companyProof", label: "Company proof" },
  { key: "panCard", label: "PAN card" },
  { key: "aadhaarCard", label: "Aadhaar card" },
  { key: "selfie", label: "Selfie" },
] as const;

type Filter = "pending" | "approved" | "rejected" | "all";
const PAGE = 12;
const docsOf = (u: AdminLpUser) => DOCS.filter((d) => u.kycDocuments?.[d.key]);

/** Figma: ADMIN / KYC Reviews. Identity review queue. */
export default function AdminKycPage() {
  return (
    <Suspense fallback={<Loading />}>
      <KycReviews />
    </Suspense>
  );
}

function KycReviews() {
  const params = useSearchParams();
  const [users, setUsers] = useState<AdminLpUser[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("user"));

  const load = () =>
    getAllLpUsers().then(setUsers, (e) => {
      setUsers([]);
      setError(e instanceof Error ? e.message : "Couldn’t load the review queue.");
    });

  useEffect(() => {
    let alive = true;
    getAllLpUsers().then(
      (u) => alive && setUsers(u),
      (e) => {
        if (!alive) return;
        setUsers([]);
        setError(e instanceof Error ? e.message : "Couldn’t load the review queue.");
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const submitted = useMemo(() => (users || []).filter((u) => u.kycStatus !== "not_submitted" || docsOf(u).length > 0), [users]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submitted
      .filter((u) => filter === "all" || u.kycStatus === filter)
      .filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q));
  }, [submitted, filter, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);
  const count = (s: string) => submitted.filter((u) => u.kycStatus === s).length;
  const selected = (users || []).find((u) => u.id === selectedId) || null;

  return (
    <>
      <PageHeader title="KYC Reviews" />

      <StatGrid>
        <StatCard label="Awaiting review" value={users ? count("pending") : "—"} />
        <StatCard label="Verified accounts" value={users ? count("approved") : "—"} />
        <StatCard label="Requires changes" value={users ? count("rejected") : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Panel
        title="Identity review queue"
        aside={
          <>
            <SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search name or email" />
            <ExportLink
              onClick={() =>
                exportCsv(
                  "kyc-reviews.csv",
                  shown.map((u) => ({ id: shortId("LP", u.id), name: u.fullName, email: u.email, kyc: u.kycStatus, documents: docsOf(u).map((d) => d.label).join(" / ") }))
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
            { value: "pending", label: "Pending", count: users ? count("pending") : undefined },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
        />
        {users === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty title={filter === "pending" ? "Queue is clear" : "Nothing here"} body="Submitted identity documents appear here for review." />
        ) : (
          <>
            <Rows>
              {shown.slice((current - 1) * PAGE, current * PAGE).map((u) => (
                <Row
                  key={u.id}
                  title={u.fullName}
                  sub={docsOf(u).map((d) => d.label).join(" • ") || "No documents"}
                  middle={u.email}
                  status={<Pill status={u.kycStatus} />}
                  onView={() => setSelectedId(u.id)}
                />
              ))}
            </Rows>
            <div className="mt-4">
              <Pager page={current} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <OpsNote>Compare every document with the account name before approving. Approval unlocks deposits and withdrawals for the client.</OpsNote>

      {selected && <ReviewDialog user={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
    </>
  );
}

function ReviewDialog({ user, onClose, onChanged }: { user: AdminLpUser; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const decide = async (status: "approved" | "rejected" | "pending") => {
    setBusy(status);
    setMsg(null);
    try {
      await updateLpUserKycStatus(user.id, status);
      await onChanged();
      setMsg({ tone: "success", text: status === "approved" ? "Identity approved." : status === "rejected" ? "Marked as requiring changes." : "Moved back to pending." });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Couldn’t update the status." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${user.fullName} · identity review`}
      wide
      footer={
        <>
          {user.kycStatus !== "pending" && (
            <Btn variant="ghost" loading={busy === "pending"} onClick={() => decide("pending")}>
              Reopen
            </Btn>
          )}
          <Btn variant="danger" loading={busy === "rejected"} disabled={user.kycStatus === "rejected"} onClick={() => decide("rejected")}>
            Request changes
          </Btn>
          <Btn loading={busy === "approved"} disabled={user.kycStatus === "approved"} onClick={() => decide("approved")}>
            Approve identity
          </Btn>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill status={user.kycStatus} />
      </div>
      <DetailList
        items={[
          ["Account", shortId("LP", user.id)],
          ["Name on account", user.fullName],
          ["Email", user.email],
          ["Mobile", user.phone || "—"],
        ]}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {DOCS.map((d) => {
          const ref = user.kycDocuments?.[d.key];
          const pdf = ref?.toLowerCase().endsWith(".pdf");
          return (
            <figure key={d.key} className="flex flex-col gap-2 rounded-[16px] border border-sfx-line p-3">
              <figcaption className="text-[13px] font-medium text-sfx-text">{d.label}</figcaption>
              {!ref ? (
                <p className="py-6 text-center text-[12px] text-sfx-muted">Not submitted</p>
              ) : pdf ? (
                <OpenFileButton fileRef={ref} className="inline-flex items-center gap-2 py-6 text-[13px] font-semibold text-sfx-gold">
                  <FileText size={16} /> Open PDF
                </OpenFileButton>
              ) : (
                <SecureImage fileRef={ref} alt={`${d.label} of ${user.fullName}`} className="h-52 w-full rounded-[12px] bg-black/30 object-contain" />
              )}
            </figure>
          );
        })}
      </div>
      {msg && <Alert tone={msg.tone} className="mt-4">{msg.text}</Alert>}
    </Dialog>
  );
}
