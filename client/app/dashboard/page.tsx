"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, ShieldAlert } from "lucide-react";

import { ActivityItem, loadActivity } from "@/components/sfx/activity";
import { ActivityList, EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { firstName, formatMoney, greeting } from "@/components/sfx/format";
import { Chip, SectionTitle, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getWalletOverview, WalletOverview } from "@/services/trades.service";
import { getWalletBalances } from "@/services/user.service";
import { KycStatus, WalletBalances } from "@/types";

const KYC_CHIP: Record<KycStatus, { label: string; tone: "gold" | "success" | "danger" | "neutral" }> = {
  approved: { label: "VERIFIED", tone: "gold" },
  pending: { label: "IN REVIEW", tone: "neutral" },
  rejected: { label: "ACTION NEEDED", tone: "danger" },
  not_submitted: { label: "UNVERIFIED", tone: "neutral" },
};

/** Figma: DARK / 15 Dashboard Preview, LIGHT / 18 Dashboard */
export default function DashboardHome() {
  const { user } = useHydratedUser();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [b, o, a] = await Promise.allSettled([getWalletBalances(), getWalletOverview(), loadActivity(5)]);
      if (!alive) return;
      setBalances(b.status === "fulfilled" ? b.value : { mainWalletBalance: 0, tradeWalletBalance: 0 });
      setOverview(o.status === "fulfilled" ? o.value : null);
      setActivity(a.status === "fulfilled" ? a.value : []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const total = (balances?.mainWalletBalance || 0) + (balances?.tradeWalletBalance || 0);
  const todayPnl = overview ? overview.profit - overview.loss - overview.charges : null;
  const kyc = KYC_CHIP[user?.kycStatus || "not_submitted"];
  const kycApproved = user?.kycStatus === "approved";

  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TopBar
        back={false}
        right={
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">OVERVIEW</span>
            <Link
              href="/dashboard/notices"
              aria-label="Notices"
              className="flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text lg:hidden"
            >
              <Bell size={18} />
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <h1 suppressHydrationWarning className="text-[24px] font-bold text-sfx-text md:text-[28px]">
          {greeting()}, {firstName(user?.fullName)}
        </h1>
        <Chip tone={kyc.tone}>{kyc.label}</Chip>
      </div>

      {user && !kycApproved && (
        <Link
          href={user.kycStatus === "not_submitted" ? "/kyc" : "/kyc/status"}
          className="flex items-center gap-3 rounded-[18px] border border-sfx-border bg-sfx-gold-soft/40 px-4 py-3 text-[13px] text-sfx-text"
        >
          <ShieldAlert size={18} className="shrink-0 text-sfx-accent" />
          <span className="flex-1">
            {user.kycStatus === "pending"
              ? "Your verification is in review. Deposits and withdrawals unlock once approved."
              : "Verify your identity to unlock deposits and withdrawals."}
          </span>
          <span className="font-semibold text-sfx-accent">{user.kycStatus === "pending" ? "Status" : "Verify"}</span>
        </Link>
      )}

      <div className="grid gap-[19px] lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="flex flex-col gap-[19px]">
          {/* Portfolio card (Figma 2:396) */}
          <section className="sfx-card flex flex-col gap-3 p-[21px]" aria-label="Total portfolio value">
            <p className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">TOTAL PORTFOLIO VALUE</p>
            {balances ? (
              <p className="text-[38px] font-bold leading-tight tracking-tight text-sfx-accent tabular-nums md:text-[44px]">
                {formatMoney(total)}
              </p>
            ) : (
              <Skeleton className="h-11 w-56" />
            )}
            <p className="text-[13px] text-sfx-text">
              {todayPnl === null ? (
                <span className="text-sfx-muted">Trading results appear once your trade account is linked.</span>
              ) : (
                <>
                  <span className={todayPnl >= 0 ? "text-sfx-accent" : "text-sfx-danger"}>
                    {todayPnl >= 0 ? "↑" : "↓"} {formatMoney(todayPnl, { sign: true })}
                  </span>{" "}
                  <span className="text-sfx-muted">today</span>
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
              <QuickAction href="/dashboard/deposite" icon={ArrowUpRight} label="Deposit" disabled={!kycApproved} />
              <QuickAction href="/dashboard/withdraw" icon={ArrowDownLeft} label="Withdraw" disabled={!kycApproved} />
              <QuickAction href="/dashboard/wallet" icon={ArrowLeftRight} label="Transfer" />
            </div>
          </section>

          {/* Stat tiles (Figma 2:408) */}
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="MAIN WALLET" value={balances ? formatMoney(balances.mainWalletBalance, { decimals: 0 }) : null} />
            <StatTile label="TRADE WALLET" value={balances ? formatMoney(balances.tradeWalletBalance, { decimals: 0 }) : null} />
            {overview && (
              <>
                <StatTile label="TRADING P&L" value={formatMoney(overview.profit - overview.loss, { sign: true, decimals: 0 })} accent />
                <StatTile label="CHARGES TODAY" value={formatMoney(overview.charges, { decimals: 0 })} />
              </>
            )}
          </div>
        </div>

        {/* Recent activity (Figma 2:415–2:416) */}
        <section className="flex flex-col gap-4" aria-label="Recent activity">
          <SectionTitle
            action={
              <Link href="/dashboard/history" className="text-[12px] font-semibold text-sfx-accent hover:underline">
                View all
              </Link>
            }
          >
            Recent activity
          </SectionTitle>
          {activity === null ? (
            <Skeleton className="h-[160px]" />
          ) : activity.length === 0 ? (
            <EmptyState title="No activity yet" body="Deposits, withdrawals and transfers will show up here." />
          ) : (
            <ActivityList items={activity} />
          )}
        </section>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  disabled,
}: {
  href: string;
  icon: typeof ArrowUpRight;
  label: string;
  disabled?: boolean;
}) {
  const cls = "inline-flex items-center gap-1 rounded-[30px] bg-sfx-gold-soft px-3 py-2 text-[11px] font-semibold text-sfx-accent sm:gap-1.5 sm:px-3.5 sm:text-[12px]";
  if (disabled) {
    return (
      <span className={cn(cls, "cursor-not-allowed opacity-45")} title="Available after verification" aria-disabled>
        <Icon size={13} /> {label}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(cls, "transition hover:brightness-110")}>
      <Icon size={13} /> {label}
    </Link>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="sfx-tile flex flex-col gap-2 p-5">
      <p className="text-[11px] font-medium tracking-[0.06em] text-sfx-muted">{label}</p>
      {value === null ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <p className={cn("text-[19px] font-semibold tabular-nums", accent ? "text-sfx-accent" : "text-sfx-text")}>{value}</p>
      )}
    </div>
  );
}
