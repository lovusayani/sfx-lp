import { getDepositeHistory, getWalletSwapHistory, getWithdrawHistory } from "@/services/user.service";
import { DepositeStatus, WithdrawStatus } from "@/types";

export type ActivityKind = "deposit" | "withdrawal" | "transfer";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  amount: number; // signed: + money in, − money out (transfers are neutral → shown unsigned)
  status: DepositeStatus | WithdrawStatus | "completed";
  createdAt?: string;
  detail?: string;
}

const depositLabel: Record<DepositeStatus, string> = {
  pending: "Deposit pending",
  approved: "Deposit credited",
  rejected: "Deposit rejected",
};

const withdrawLabel: Record<WithdrawStatus, string> = {
  pending: "Withdrawal requested",
  processing: "Withdrawal processing",
  approved: "Withdrawal paid",
  rejected: "Withdrawal rejected",
  cancelled: "Withdrawal cancelled",
};

/** Merges deposits, withdrawals and wallet transfers into one newest-first feed. Missing sources are skipped. */
export async function loadActivity(limit?: number): Promise<ActivityItem[]> {
  const [deposits, withdrawals, swaps] = await Promise.allSettled([
    getDepositeHistory(),
    getWithdrawHistory(),
    getWalletSwapHistory(),
  ]);

  const items: ActivityItem[] = [];

  if (deposits.status === "fulfilled") {
    for (const d of deposits.value) {
      items.push({
        id: `dep-${d.id}`,
        kind: "deposit",
        title: depositLabel[d.status] ?? "Deposit",
        amount: d.amount,
        status: d.status,
        createdAt: d.createdAt,
        detail: d.network || d.depositeType?.replace("_", " "),
      });
    }
  }
  if (withdrawals.status === "fulfilled") {
    for (const w of withdrawals.value) {
      items.push({
        id: `wd-${w.id}`,
        kind: "withdrawal",
        title: withdrawLabel[w.status] ?? "Withdrawal",
        amount: -Math.abs(w.amount),
        status: w.status,
        createdAt: w.createdAt,
        detail: `${w.currency} · ${w.chainType}`,
      });
    }
  }
  if (swaps.status === "fulfilled") {
    for (const s of swaps.value) {
      items.push({
        id: `sw-${s.id}`,
        kind: "transfer",
        title: s.direction === "main_to_trade" ? "Main → Trade wallet" : "Trade → Main wallet",
        amount: s.amount,
        status: "completed",
        createdAt: s.createdAt,
        detail: "Wallet transfer",
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return typeof limit === "number" ? items.slice(0, limit) : items;
}
