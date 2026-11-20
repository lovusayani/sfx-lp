"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Wallet } from "lucide-react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { formatDate, formatMoney } from "@/components/sfx/format";
import { KycGate, Sheet, StatusChip } from "@/components/sfx/kit";
import { Alert, Button, Display, Eyebrow, Field, SectionTitle, SelectField, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import {
  createWithdraw,
  getWalletBalances,
  getWithdrawHistory,
  getWithdrawWallet,
  saveWithdrawWallet,
} from "@/services/user.service";
import { WithdrawChain, WithdrawRecord, WithdrawWallet } from "@/types";

const CHAINS: WithdrawChain[] = ["TRC20", "ERC20", "BEP20"];
const short = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const normalizeChain = (v?: string): WithdrawChain => {
  const up = String(v ?? "").toUpperCase();
  return (CHAINS as string[]).includes(up) ? (up as WithdrawChain) : "TRC20";
};

/** Withdraw: payout wallet + request + history. Paid out from the Main wallet. */
export default function WithdrawPage() {
  const { user } = useHydratedUser();
  const [available, setAvailable] = useState<number | null>(null);
  const [wallet, setWallet] = useState<WithdrawWallet | null | undefined>(undefined);
  const [history, setHistory] = useState<WithdrawRecord[] | null>(null);
  const [editing, setEditing] = useState(false);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBalance = () =>
    getWalletBalances().then(
      (b) => setAvailable(b.mainWalletBalance ?? 0),
      () => setAvailable(user?.mainWalletBalance ?? 0)
    );

  useEffect(() => {
    loadBalance();
    getWithdrawWallet().then(setWallet, () => setWallet(null));
    getWithdrawHistory().then(setHistory, () => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user && user.kycStatus !== "approved") {
    return (
      <div className="sfx-enter flex flex-col gap-3.5">
        <TopBar backHref="/dashboard/wallet" caption="WITHDRAW" />
        <Display size="md" title="Withdraw funds" />
        <KycGate status={user.kycStatus} />
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    setError("");
    setSuccess("");
    if (!Number.isFinite(n) || n <= 0) return setError("Enter the amount you want to withdraw.");
    if (available !== null && n > available + 1e-9) return setError(`You can withdraw up to ${formatMoney(available)}.`);
    setBusy(true);
    try {
      const record = await createWithdraw(n);
      setHistory((prev) => [record, ...(prev || [])]);
      setAmount("");
      setSuccess(`Request for ${formatMoney(n)} sent. We’ll notify you when it’s paid.`);
      loadBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar backHref="/dashboard/wallet" caption="WITHDRAW" />

      <div className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3.5">
          <section className="sfx-card flex flex-col gap-3 p-4" aria-label="Available to withdraw">
            <p className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">AVAILABLE TO WITHDRAW</p>
            {available === null ? (
              <Skeleton className="h-11 w-48" />
            ) : (
              <p className="text-[38px] font-bold leading-tight tracking-tight text-sfx-accent tabular-nums md:text-[44px]">
                {formatMoney(available)}
              </p>
            )}
            <p className="text-[13px] text-sfx-muted">Paid from your Main wallet. Move funds from Trade in Wallet → Transfer.</p>
          </section>

          {/* Payout wallet */}
          {wallet === undefined ? (
            <Skeleton className="h-[92px]" />
          ) : wallet ? (
            <section className="sfx-tile flex items-center gap-3 p-4" aria-label="Payout wallet">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
                <Wallet size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <Eyebrow>Payout wallet · {wallet.chainType}</Eyebrow>
                <p className="mt-1 truncate font-mono text-[13px] text-sfx-text" title={wallet.walletAddress}>
                  {short(wallet.walletAddress)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Change payout wallet"
                className="flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text"
              >
                <Pencil size={16} />
              </button>
            </section>
          ) : (
            <section className="sfx-card flex flex-col gap-3 p-4">
              <p className="text-[16px] font-semibold text-sfx-text">Add a payout wallet</p>
              <p className="text-[13px] text-sfx-muted">Tell us where to send your USDT. You only need to do this once.</p>
              <Button onClick={() => setEditing(true)}>Add wallet</Button>
            </section>
          )}

          {wallet && (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field
                label="Amount (USDT)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                hint={available !== null ? `Available ${formatMoney(available)}` : undefined}
                trailing={
                  <button
                    type="button"
                    onClick={() => available !== null && setAmount(String(Math.floor(available * 100) / 100))}
                    className="px-4 text-[11px] font-semibold uppercase tracking-wide text-sfx-accent"
                  >
                    Max
                  </button>
                }
              />
              {error && <Alert>{error}</Alert>}
              {success && <Alert tone="success">{success}</Alert>}
              <Button type="submit" loading={busy} disabled={!available}>
                Request withdrawal
              </Button>
            </form>
          )}
        </div>

        <section className="flex flex-col gap-4" aria-label="Withdrawal history">
          <SectionTitle>Withdrawals</SectionTitle>
          {history === null ? (
            <Skeleton className="h-[160px]" />
          ) : history.length === 0 ? (
            <EmptyState title="No withdrawals yet" body="Your requests and their status will appear here." />
          ) : (
            <ul className="sfx-card divide-y divide-sfx-line px-4 py-2">
              {history.map((w) => (
                <li key={w.id} className="flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium tabular-nums text-sfx-text">
                      {formatMoney(w.amount)} <span className="text-[11px] font-normal text-sfx-muted">{w.currency}</span>
                    </p>
                    <p className="text-[11px] text-sfx-muted">
                      {[formatDate(w.createdAt), w.chainType, short(w.walletAddress || "")].filter(Boolean).join(" · ")}
                    </p>
                    {w.adminRemark && <p className="mt-1 text-[12px] text-sfx-muted">“{w.adminRemark}”</p>}
                  </div>
                  <StatusChip status={w.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <WalletSheet
        open={editing}
        current={wallet || null}
        onClose={() => setEditing(false)}
        onSaved={(w) => {
          setWallet(w);
          setEditing(false);
        }}
      />
    </div>
  );
}

function WalletSheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: WithdrawWallet | null;
  onClose: () => void;
  onSaved: (wallet: WithdrawWallet) => void;
}) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<WithdrawChain>("TRC20");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAddress(current?.walletAddress?.trim() || "");
    setChain(normalizeChain(current?.chainType));
    setError("");
  }, [open, current]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (address.trim().length < 20) return setError("Enter a complete wallet address.");
    setBusy(true);
    setError("");
    try {
      onSaved(await saveWithdrawWallet({ walletAddress: address.trim(), chainType: chain, currency: "USDT" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the wallet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={current ? "Change payout wallet" : "Add payout wallet"}>
      <form onSubmit={save} className="flex flex-col gap-5">
        <SelectField
          label="Network"
          value={chain}
          onChange={(v) => setChain(v as WithdrawChain)}
          options={CHAINS.map((c) => ({ value: c, label: `USDT · ${c}` }))}
        />
        <Field
          label="Wallet address"
          placeholder={chain === "TRC20" ? "T…" : "0x…"}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          error={error || undefined}
          hint="Double-check the address and network. Payments sent to a wrong address can’t be recovered."
        />
        <Button type="submit" loading={busy}>
          Save wallet
        </Button>
      </form>
    </Sheet>
  );
}
