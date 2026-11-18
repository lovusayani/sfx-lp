import { ExternalTrade } from "./apiSource.service";

/**
 * Daily wallet overview arithmetic, kept free of I/O so it can be reasoned
 * about (and tested) on its own.
 *
 * Rules:
 *  - Profit/loss are REALISED P&L only: trades whose close_datetime falls on
 *    `day`. A trade is therefore counted exactly once, on the day it closes.
 *    (Counting open trades let floating P&L leak into the wallet, and a trade
 *    opened yesterday and closed today was counted on both days.)
 *  - Each refresh applies the SIGNED difference between today's totals and the
 *    totals already applied. Increases and decreases are both applied, so the
 *    wallet's trading effect for the day always equals
 *    profit - loss - charges, while balance changes made in between (wallet
 *    swaps, admin adjustments) are preserved.
 */

export interface DayTotals {
  charges: number;
  profit: number;
  loss: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Realised profit and loss for trades closed on `day` (YYYY-MM-DD, UTC). */
export function realisedTotals(trades: ExternalTrade[], day: string): { profit: number; loss: number } {
  let profit = 0;
  let loss = 0;
  for (const t of trades) {
    if (t.status !== "Closed" || !t.close_datetime || t.close_datetime.slice(0, 10) !== day) continue;
    const pnl = Number(t.pnl) || 0;
    if (pnl > 0) profit += pnl;
    else if (pnl < 0) loss += -pnl;
  }
  return { profit: round2(profit), loss: round2(loss) };
}

/** Amount to add to the trade wallet to move from `applied` to `current` totals. */
export function balanceDelta(applied: DayTotals, current: DayTotals): number {
  return round2(
    current.profit - applied.profit - (current.loss - applied.loss) - (current.charges - applied.charges)
  );
}
