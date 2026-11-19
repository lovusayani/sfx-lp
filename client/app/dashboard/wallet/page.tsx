"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Lock } from "lucide-react";

import { ActivityItem, loadActivity } from "@/components/sfx/activity";
import { ActivityList, EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { formatMoney } from "@/components/sfx/format";
import { Segmented, Sheet } from "@/components/sfx/kit";
import { Alert, Button, Field, SectionTitle, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getWalletBalances, swapWalletBalance } from "@/services/user.service";
import { WalletBalances, WalletSwapDirection } from "@/types";

/** Wallet: balances, transfers between Main and Trade, entry to deposit / withdraw. */
export default function WalletPage() {
  const { user } = useHydratedUser();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [transfers, setTransfers] = useState<ActivityItem[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(
    () =>
      Promise.allSettled([getWalletBalances(), loadActivity()]).then(([b, a]) => {
        setBalances(b.status === "fulfilled" ? b.value : { mainWalletBalance: 0, tradeWalletBalance: 0 });
        setTransfers(a.status === "fulfilled" ? a.value.filter((i) => i.kind === "transfer") : []);
      }),
    []
  );

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getWalletBalances(), loadActivity()]).then(([b, a]) => {
      if (!alive) return;
      setBalances(b.status === "fulfilled" ? b.value : { mainWalletBalance: 0, tradeWalletBalance: 0 });
      setTransfers(a.status === "fulfilled" ? a.value.filter((i) => i.kind === "transfer") : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const main = balances?.mainWalletBalance ?? 0;
  const trade = balances?.tradeWalletBalance ?? 0;
  const lockIn = balances?.lockInBalance ?? user?.lockInBalance ?? 0;
  const kycApproved = user?.kycStatus === "approved";

  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TopBar backHref="/dashboard" caption="WALLET" />

      <div className="grid gap-[19px] lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="flex flex-col gap-[19px]">
          <section className="sfx-card flex flex-col gap-3 p-[21px]" aria-label="Total balance">
            <p className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">TOTAL BALANCE</p>
            {balances ? (
              <p className="text-[38px] font-bold leading-tight tracking-tight text-sfx-accent tabular-nums md:text-[44px]">
                {formatMoney(main + trade)}
              </p>
            ) : (
              <Skeleton className="h-11 w-56" />
            )}
            <p className="text-[13px] text-sfx-muted">USDT across your Main and Trade wallets.</p>
          </section>

          <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WalletTile label="MAIN WALLET" hint="Deposits & withdrawals" value={balances ? formatMoney(main) : null} />
            <WalletTile
              label="TRADE WALLET"
              hint={
                lockIn > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock size={11} /> {formatMoney(lockIn, { decimals: 0 })} minimum kept
                  </span>
                ) : (
                  "Used for trading"
                )
              }
              value={balances ? formatMoney(trade) : null}
            />
          </div>

          {notice && <Alert tone="success">{notice}</Alert>}

          <div className="grid grid-cols-3 gap-3">
            <ActionTile icon={ArrowLeftRight} label="Transfer" onClick={() => (setNotice(""), setSheetOpen(true))} />
            <ActionTile icon={ArrowUpRight} label="Deposit" href="/dashboard/deposite" disabled={!kycApproved} />
            <ActionTile icon={ArrowDownLeft} label="Withdraw" href="/dashboard/withdraw" disabled={!kycApproved} />
          </div>
          {!kycApproved && user && (
            <p className="-mt-2 text-[12px] text-sfx-muted">
              Deposits and withdrawals unlock after{" "}
              <Link href={user.kycStatus === "pending" ? "/kyc/status" : "/kyc"} className="font-semibold text-sfx-accent">
                identity verification
              </Link>
              .
            </p>
          )}
        </div>

        <section className="flex flex-col gap-4" aria-label="Transfers">
          <SectionTitle
            action={
              <Link href="/dashboard/history" className="text-[12px] font-semibold text-sfx-accent hover:underline">
                All activity
              </Link>
            }
          >
            Transfers
          </SectionTitle>
          {transfers === null ? (
            <Skeleton className="h-[160px]" />
          ) : transfers.length === 0 ? (
            <EmptyState title="No transfers yet" body="Move funds between your Main and Trade wallets with Transfer." />
          ) : (
            <ActivityList items={transfers.slice(0, 8)} showDates />
          )}
        </section>
      </div>

      <TransferSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        main={main}
        trade={trade}
        lockIn={lockIn}
        onDone={async (msg) => {
          setSheetOpen(false);
          setNotice(msg);
          await refresh();
        }}
      />
    </div>
  );
}

function WalletTile({ label, hint, value }: { label: string; hint: React.ReactNode; value: string | null }) {
  return (
    <div className="sfx-tile flex flex-col gap-2 p-5">
      <p className="text-[11px] font-medium tracking-[0.06em] text-sfx-muted">{label}</p>
      {value === null ? <Skeleton className="h-7 w-28" /> : <p className="text-[22px] font-semibold tabular-nums text-sfx-text">{value}</p>}
      <p className="text-[11px] text-sfx-muted">{hint}</p>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  href,
  onClick,
  disabled,
}: {
  icon: typeof ArrowUpRight;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = cn(
    "flex flex-col items-center gap-2 rounded-[22px] border border-sfx-line bg-sfx-surface-2 py-4 text-[12px] font-semibold text-sfx-text transition",
    disabled ? "cursor-not-allowed opacity-45" : "hover:border-sfx-border-strong"
  );
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
        <Icon size={18} />
      </span>
      {label}
    </>
  );
  if (disabled) {
    return (
      <span className={cls} aria-disabled title="Available after verification">
        {body}
      </span>
    );
  }
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function TransferSheet({
  open,
  onClose,
  main,
  trade,
  lockIn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  main: number;
  trade: number;
  lockIn: number;
  onDone: (message: string) => void;
}) {
  const [direction, setDirection] = useState<WalletSwapDirection>("main_to_trade");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setError("");
    }
  }, [open]);

  const available = direction === "main_to_trade" ? main : Math.max(trade - lockIn, 0);
  const round = (n: number) => Math.floor(n * 100) / 100;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setError("Enter an amount greater than zero.");
    if (n > available + 1e-9) return setError(`You can move up to ${formatMoney(available)}.`);
    setBusy(true);
    setError("");
    try {
      await swapWalletBalance(direction, n);
      onDone(`${formatMoney(n)} moved to your ${direction === "main_to_trade" ? "Trade" : "Main"} wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Transfer between wallets">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Segmented
          label="Direction"
          value={direction}
          onChange={(v) => (setDirection(v), setError(""))}
          options={[
            { value: "main_to_trade", label: "Main → Trade" },
            { value: "trade_to_main", label: "Trade → Main" },
          ]}
        />
        <Field
          label="Amount (USDT)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error || undefined}
          hint={
            direction === "trade_to_main" && lockIn > 0
              ? `Available ${formatMoney(available)} · ${formatMoney(lockIn, { decimals: 0 })} stays locked in Trade`
              : `Available ${formatMoney(available)}`
          }
          trailing={
            <button
              type="button"
              onClick={() => setAmount(String(round(available)))}
              className="px-4 text-[11px] font-semibold uppercase tracking-wide text-sfx-accent"
            >
              Max
            </button>
          }
          autoFocus
        />
        <Button type="submit" loading={busy} disabled={available <= 0}>
          Confirm transfer
        </Button>
      </form>
    </Sheet>
  );
}
