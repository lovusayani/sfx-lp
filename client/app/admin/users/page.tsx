"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import {
  Btn,
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
import { Pager, Segmented } from "@/components/sfx/kit";
import { Alert, Field, SelectField } from "@/components/sfx/ui";
import {
  adjustAdminLpMainBalance,
  AdminLpUser,
  createLpUser,
  getAllLpUsers,
  updateAdminUserPushPreference,
  updateLpUserLockInBalance,
  updateLpUserPassword,
  updateLpUserStatus,
} from "@/services/admin.service";

type Filter = "all" | "active" | "kyc" | "suspended";
const PAGE = 12;
const total = (u: AdminLpUser) => (u.mainWalletBalance || 0) + (u.tradeWalletBalance || 0);

/** Figma: ADMIN / Users. LP accounts, balances and account controls. */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminLpUser[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminLpUser | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () =>
    getAllLpUsers().then(
      (u) => {
        setUsers(u);
        setSelected((s) => (s ? u.find((x) => x.id === s.id) || null : s));
      },
      (e) => {
        setUsers([]);
        setError(e instanceof Error ? e.message : "Couldn’t load users.");
      }
    );

  useEffect(() => {
    let alive = true;
    getAllLpUsers().then(
      (u) => alive && setUsers(u),
      (e) => {
        if (!alive) return;
        setUsers([]);
        setError(e instanceof Error ? e.message : "Couldn’t load users.");
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => users || [], [users]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((u) =>
        filter === "active" ? u.status === "active" : filter === "suspended" ? u.status === "suspended" : filter === "kyc" ? u.kycStatus === "pending" : true
      )
      .filter((u) => !q || `${u.fullName} ${u.email} ${u.phone || ""}`.toLowerCase().includes(q));
  }, [list, filter, query]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages);

  return (
    <>
      <PageHeader
        title="Users"
        actions={
          <Btn onClick={() => setCreating(true)}>
            <Plus size={16} /> New LP account
          </Btn>
        }
      />

      <StatGrid>
        <StatCard label="Total accounts" value={users ? list.length.toLocaleString() : "—"} />
        <StatCard label="Verified users" value={users ? list.filter((u) => u.kycStatus === "approved").length.toLocaleString() : "—"} />
        <StatCard label="Restricted accounts" value={users ? list.filter((u) => u.status === "suspended").length.toLocaleString() : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Panel
        title="Users activity"
        aside={
          <>
            <SearchBox value={query} onChange={(v) => (setQuery(v), setPage(1))} placeholder="Search name or email" />
            <ExportLink
              onClick={() =>
                exportCsv(
                  "lp-users.csv",
                  shown.map((u) => ({
                    id: shortId("LP", u.id),
                    name: u.fullName,
                    email: u.email,
                    phone: u.phone || "",
                    status: u.status,
                    kyc: u.kycStatus,
                    main_wallet: u.mainWalletBalance || 0,
                    trade_wallet: u.tradeWalletBalance || 0,
                    lock_in: u.lockInBalance || 0,
                    joined: u.createdAt || "",
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
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "kyc", label: "KYC pending" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        {users === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty title={list.length ? "No matching users" : "No LP accounts yet"} body={list.length ? "Try another filter or search." : "Create the first LP account with “New LP account”."} />
        ) : (
          <>
            <Rows>
              {shown.slice((current - 1) * PAGE, current * PAGE).map((u) => (
                <Row
                  key={u.id}
                  title={u.fullName}
                  sub={`${shortId("LP", u.id)} • ${u.email}`}
                  middle={money(total(u), 0)}
                  middleSub={u.kycStatus === "approved" ? "Verified" : u.kycStatus === "pending" ? "KYC in review" : u.kycStatus === "rejected" ? "KYC rejected" : "Unverified"}
                  status={<Pill status={u.status} />}
                  onView={() => setSelected(u)}
                />
              ))}
            </Rows>
            <div className="mt-4">
              <Pager page={current} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <OpsNote />

      <UserDialog user={selected} onClose={() => setSelected(null)} onChanged={load} />
      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(u) => {
          setUsers((prev) => [u, ...(prev || [])]);
          setCreating(false);
        }}
      />
    </>
  );
}

/* ── User detail & controls ────────────────────────────────────────── */

const CREDIT = ["Bonus", "Referrals", "Adjustment", "Promotion", "Manual Credit"];
const DEBIT = ["Tax", "Transfer Fees", "Penalty", "Service Charge", "Manual Deduction"];

function UserDialog({ user, onClose, onChanged }: { user: AdminLpUser | null; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [lockIn, setLockIn] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<"credit" | "debit">("credit");
  const [category, setCategory] = useState(CREDIT[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  // Reset the form whenever a different user is opened.
  if (user && user.id !== lastId) {
    setLastId(user.id);
    setLockIn(String(user.lockInBalance ?? 0));
    setPassword("");
    setAction("credit");
    setCategory(CREDIT[0]);
    setAmount("");
    setNote("");
    setMsg(null);
  }

  if (!user) return null;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await onChanged();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "That didn’t work. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const adjust = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setMsg({ tone: "danger", text: "Enter an amount greater than 0." });
    run(
      "adjust",
      () => adjustAdminLpMainBalance(user.id, { action, amount: n, category, note: note.trim() || undefined }),
      `${action === "credit" ? "Credited" : "Debited"} ${money(n)} (${category}).`
    ).then(() => (setAmount(""), setNote("")));
  };

  return (
    <Dialog open onClose={() => (setLastId(null), onClose())} title={user.fullName} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill status={user.status} />
            <Pill status={user.kycStatus === "approved" ? "verified" : user.kycStatus} label={`KYC: ${user.kycStatus.replace("_", " ")}`} />
          </div>
          <DetailList
            items={[
              ["Account", shortId("LP", user.id)],
              ["Email", user.email],
              ["Mobile", user.phone || "—"],
              ["Joined", user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB") : "—"],
              ["Main wallet", money(user.mainWalletBalance)],
              ["Trade wallet", money(user.tradeWalletBalance)],
              ["Lock-in (trade)", money(user.lockInBalance)],
              ["Push notifications", user.settings?.alerts ? "On" : "Off"],
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Btn
              variant={user.status === "active" ? "danger" : "primary"}
              loading={busy === "status"}
              onClick={() =>
                run(
                  "status",
                  () => updateLpUserStatus(user.id, user.status === "active" ? "suspended" : "active"),
                  user.status === "active" ? "Account suspended." : "Account reactivated."
                )
              }
            >
              {user.status === "active" ? "Suspend account" : "Reactivate account"}
            </Btn>
            <Btn
              variant="secondary"
              loading={busy === "push"}
              onClick={() =>
                run("push", () => updateAdminUserPushPreference(user.id, !user.settings?.alerts), `Push notifications turned ${user.settings?.alerts ? "off" : "on"}.`)
              }
            >
              Push {user.settings?.alerts ? "off" : "on"}
            </Btn>
            {user.kycStatus !== "not_submitted" && (
              <Link href={`/admin/kyc?user=${user.id}`} className="inline-flex h-[42px] items-center rounded-[14px] bg-sfx-surface-2 px-4 text-[13px] font-semibold text-sfx-text hover:brightness-125">
                Review KYC
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-[14px] font-semibold text-sfx-text">Adjust main wallet</h3>
            <Segmented
              label="Adjustment"
              value={action}
              onChange={(v) => (setAction(v), setCategory((v === "credit" ? CREDIT : DEBIT)[0]))}
              options={[
                { value: "credit", label: "Credit" },
                { value: "debit", label: "Debit" },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Category" value={category} onChange={setCategory} options={(action === "credit" ? CREDIT : DEBIT).map((c) => ({ value: c, label: c }))} />
              <Field label="Amount (USDT)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            <Btn loading={busy === "adjust"} onClick={adjust}>
              {action === "credit" ? "Credit wallet" : "Debit wallet"}
            </Btn>
          </section>

          <section className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label="Lock-in balance (trade)" type="number" min="0" step="0.01" value={lockIn} onChange={(e) => setLockIn(e.target.value)} />
            <Btn
              variant="secondary"
              loading={busy === "lock"}
              onClick={() => {
                const n = Number(lockIn);
                if (!Number.isFinite(n) || n < 0) return setMsg({ tone: "danger", text: "Enter a valid lock-in amount." });
                run("lock", () => updateLpUserLockInBalance(user.id, n), "Lock-in balance updated.");
              }}
            >
              Save
            </Btn>
          </section>

          <section className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label="Set new password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="6+ characters with a letter and a number. Share it securely." />
            <Btn
              variant="secondary"
              className="mb-[26px]"
              loading={busy === "pw"}
              onClick={() => {
                if (password.trim().length < 6 || !/[a-z]/i.test(password) || !/\d/.test(password)) return setMsg({ tone: "danger", text: "Use at least 6 characters with a letter and a number." });
                run("pw", () => updateLpUserPassword(user.id, password.trim()), "Password updated.").then(() => setPassword(""));
              }}
            >
              Set
            </Btn>
          </section>
        </div>
      </div>
      {msg && <Alert tone={msg.tone} className="mt-5">{msg.text}</Alert>}
    </Dialog>
  );
}

/* ── Create LP account ─────────────────────────────────────────────── */

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: AdminLpUser) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (form.fullName.trim().length < 2) return setError("Enter the full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email.");
    if (form.password.length < 6 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) return setError("Use at least 6 characters with a letter and a number.");
    setBusy(true);
    setError("");
    try {
      const u = await createLpUser({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password });
      setForm({ fullName: "", email: "", phone: "", password: "" });
      onCreated(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New LP account"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={() => submit()} loading={busy}>
            Create account
          </Btn>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name" value={form.fullName} onChange={set("fullName")} autoComplete="off" />
        <Field label="Email" type="email" value={form.email} onChange={set("email")} autoComplete="off" />
        <Field label="Mobile (optional)" type="tel" value={form.phone} onChange={set("phone")} autoComplete="off" />
        <Field label="Temporary password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" hint="They’ll be asked to change it at first sign-in." />
        {error && <Alert>{error}</Alert>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
