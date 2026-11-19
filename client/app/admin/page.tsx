"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { ago, compactMoney, Empty, Loading, money, PageHeader, Panel, Pill, Rows, StatCard, StatGrid, shortId } from "@/components/admin/ui";
import { cn } from "@/components/sfx/cn";
import {
  AdminDashboardStats,
  AdminDepositeRecord,
  AdminLpUser,
  AdminWithdrawRequestRecord,
  getAdminDashboardStats,
  getAdminNotificationOverview,
  getAdminWithdrawRequests,
  getAllAdminDeposites,
  getAllLpUsers,
} from "@/services/admin.service";

type Data = {
  stats: AdminDashboardStats | null;
  users: AdminLpUser[];
  deposits: AdminDepositeRecord[];
  withdrawals: AdminWithdrawRequestRecord[];
  push: boolean | null;
  loadedAt: Date;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const isOpen = (s: string) => s === "pending" || s === "processing";

/** Figma: ADMIN / Overview ("Command center"). */
export default function AdminOverviewPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getAdminDashboardStats(), getAllLpUsers(), getAllAdminDeposites(), getAdminWithdrawRequests(), getAdminNotificationOverview()]).then(
      ([s, u, d, w, n]) => {
        if (!alive) return;
        setData({
          stats: s.status === "fulfilled" ? s.value : null,
          users: u.status === "fulfilled" ? u.value : [],
          deposits: d.status === "fulfilled" ? d.value : [],
          withdrawals: w.status === "fulfilled" ? w.value : [],
          push: n.status === "fulfilled" ? n.value.serverConfigured : null,
          loadedAt: new Date(),
        });
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const thisMonth = monthKey(now);
    const inMonth = (iso?: string) => Boolean(iso) && monthKey(new Date(iso!)) === thisMonth;

    const kycPending = data.users.filter((u) => u.kycStatus === "pending");
    const pendingDeposits = data.deposits.filter((d) => d.status === "pending");
    const openWithdrawals = data.withdrawals.filter((w) => isOpen(w.status));
    const newUsers = data.users.filter((u) => inMonth(u.createdAt)).length;
    const assets = data.stats ? data.stats.totalMainBalance + data.stats.totalTradeBalance : data.users.reduce((a, u) => a + (u.mainWalletBalance || 0) + (u.tradeWalletBalance || 0), 0);

    // Capital flow: approved deposits − approved withdrawals per month, last 12 months.
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: monthKey(d), label: MONTHS[d.getMonth()], value: 0 };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    data.deposits.filter((d) => d.status === "approved").forEach((d) => {
      const i = idx.get(monthKey(new Date(d.reviewedAt || d.createdAt || 0)));
      if (i !== undefined) buckets[i].value += d.amount;
    });
    data.withdrawals.filter((w) => w.status === "approved").forEach((w) => {
      const i = idx.get(monthKey(new Date(w.reviewedAt || w.createdAt || 0)));
      if (i !== undefined) buckets[i].value -= w.amount;
    });
    const netFlow = buckets.reduce((a, b) => a + b.value, 0);
    const monthDeposits = data.deposits.filter((d) => d.status === "approved" && inMonth(d.reviewedAt || d.createdAt)).reduce((a, d) => a + d.amount, 0);

    const queue = [
      ...pendingDeposits.map((d) => ({ id: d.id, ref: shortId("DEP", d.id), name: d.user.fullName, amount: d.amount, at: d.createdAt, href: "/admin/deposits", kind: "Deposit" })),
      ...openWithdrawals.map((w) => ({ id: w.id, ref: shortId("WDR", w.id), name: w.user.fullName, amount: w.amount, at: w.createdAt, href: "/admin/withdrawals", kind: "Withdrawal" })),
    ]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 5);

    return {
      assets,
      monthDeposits,
      active: data.users.filter((u) => u.status === "active").length,
      newUsers,
      kycPending: kycPending.length,
      pendingDeposits,
      openWithdrawals,
      payouts: openWithdrawals.reduce((a, w) => a + w.amount, 0),
      buckets,
      netFlow,
      queue,
    };
  }, [data]);

  const max = view ? Math.max(1, ...view.buckets.map((b) => Math.abs(b.value))) : 1;

  return (
    <>
      <PageHeader title="Command center" subtitle="LP management • Performance & operations" />

      {!view || !data ? (
        <Loading rows={5} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard caps label="Total assets" value={compactMoney(view.assets)} note={`${compactMoney(view.monthDeposits)} deposited this month`} />
            <StatCard caps label="Active LP accounts" value={view.active.toLocaleString()} note={`+${view.newUsers} new this month`} />
            <StatCard caps label="KYC pending" value={view.kycPending} note={view.kycPending ? "Require review" : "Queue is clear"} noteTone={view.kycPending ? "gold" : "muted"} />
            <StatCard
              caps
              label="Pending payouts"
              value={compactMoney(view.payouts)}
              note={`${view.openWithdrawals.length} request${view.openWithdrawals.length === 1 ? "" : "s"} waiting`}
              noteTone={view.openWithdrawals.length ? "danger" : "muted"}
            />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <Panel title="Capital flow" aside="Last 12 months">
              <div className="mb-6 flex items-center gap-3">
                <p className="text-[32px] font-bold tabular-nums text-sfx-text">{compactMoney(view.netFlow)}</p>
                <span className="rounded-[12px] bg-sfx-gold px-3 py-1.5 text-[12px] font-semibold text-sfx-on-gold">Net deposits</span>
              </div>
              <div className="flex h-[150px] items-end gap-[3%]" role="img" aria-label="Net deposits per month, last 12 months">
                {view.buckets.map((b, i) => (
                  <div key={b.key} className="flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${money(b.value, 0)}`}>
                    <div
                      className={cn("w-full rounded-[6px]", i >= 9 ? "bg-sfx-gold" : "bg-[#6b632c]", b.value < 0 && "bg-sfx-danger/60")}
                      style={{ height: `${Math.max(4, (Math.abs(b.value) / max) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-[12px] text-sfx-muted">
                {view.buckets.filter((_, i) => i % 2 === 0).map((b) => (
                  <span key={b.key}>{b.label}</span>
                ))}
                <span>USD</span>
              </div>
            </Panel>

            <Panel title="Requests requiring review" aside="Priority queue">
              {view.queue.length === 0 ? (
                <Empty title="Nothing waiting" body="New deposits and withdrawals that need a decision will appear here." />
              ) : (
                <Rows>
                  {view.queue.map((q) => (
                    <li key={q.id} className="flex items-center gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-sfx-text">
                          {q.ref} • {q.name}
                        </p>
                        <p className="truncate text-[12px] text-sfx-muted">
                          {q.kind} · submitted {ago(q.at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[14px] tabular-nums text-sfx-text/90">{money(q.amount, 0)}</span>
                      <Pill status="pending" />
                      <Link href={q.href} className="hidden text-[13px] font-semibold text-sfx-gold hover:underline sm:inline">
                        View
                      </Link>
                    </li>
                  ))}
                </Rows>
              )}
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="System status" aside="Live">
              <ul className="flex flex-col gap-2.5 text-[14px]">
                <StatusLine ok={Boolean(data.stats)} text={data.stats ? "API and database reachable" : "Couldn’t read platform statistics"} />
                <StatusLine
                  ok={data.push !== false}
                  text={data.push === null ? "Push service status unknown" : data.push ? "Push notifications configured" : "Push notifications not configured"}
                />
              </ul>
              <p className="mt-4 text-[12px] text-sfx-muted">Last refreshed {data.loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
            </Panel>

            <Panel title="Today’s workflow" aside="Next actions">
              <ul className="flex flex-col gap-3 text-[15px] text-sfx-text">
                <WorkItem n={view.kycPending} text="KYC reviews queued" href="/admin/kyc" />
                <WorkItem n={view.pendingDeposits.length} text="Deposits awaiting proof check" href="/admin/deposits" />
                <WorkItem n={view.openWithdrawals.length} text="Withdrawals need approval" href="/admin/withdrawals" />
              </ul>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function StatusLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-2.5", ok ? "text-sfx-success" : "text-sfx-danger")}>
      <span className={cn("h-2.5 w-2.5 rounded-full", ok ? "bg-sfx-success" : "bg-sfx-danger")} aria-hidden />
      {text}
    </li>
  );
}

function WorkItem({ n, text, href }: { n: number; text: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group inline-flex items-center gap-3 hover:text-sfx-gold">
        <span className="w-6 tabular-nums text-sfx-muted group-hover:text-sfx-gold">{n}</span>
        {text}
        <ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" />
      </Link>
    </li>
  );
}
