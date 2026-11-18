import { Request, Response } from "express";

import { ApiSource } from "../models/ApiSource";
import { OrderCharge } from "../models/OrderCharge";
import { TradeWallet } from "../models/TradeWallet";
import { WalletDailySummary } from "../models/WalletDailySummary";
import { ExternalTrade, fetchTradesFromSource } from "../services/apiSource.service";
import { recordOrderCharges } from "../services/orderCharge.service";
import { asyncHandler } from "../utils/asyncHandler";
import { balanceDelta, realisedTotals, round2 } from "../services/walletOverview.service";

export const getTrades = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const status = req.query.status as "open" | "closed" | "all" | undefined;
  const days = req.query.days ? Number(req.query.days) : undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;

  const sources = await ApiSource.find({ assignedUsers: req.user._id, isActive: true }).lean();

  if (sources.length === 0) {
    return res.json({ success: true, data: [], total: 0, limit: limit || 100, offset: offset || 0 });
  }

  const results = await Promise.allSettled(
    sources.map((source) =>
      fetchTradesFromSource(
        { baseUrl: source.baseUrl, apiKey: source.apiKey, authHeader: source.authHeader },
        { status, days, from, to, limit, offset }
      )
    )
  );

  const merged: (ExternalTrade & { source: string; ownerUserId?: string })[] = [];
  let total = 0;

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const ownerUserId = sources[i].assignedUsers.length === 1 ? String(sources[i].assignedUsers[0]) : undefined;
      merged.push(...result.value.data.map((trade) => ({ ...trade, source: sources[i].name, ownerUserId })));
      total += result.value.total;
    } else {
      console.warn(`API source "${sources[i].name}" failed:`, result.reason);
    }
  });

  merged.sort((a, b) => new Date(b.open_datetime).getTime() - new Date(a.open_datetime).getTime());

  try {
    await recordOrderCharges(merged);
  } catch (err) {
    console.warn("Failed to record order charges:", err);
  }

  return res.json({
    success: true,
    data: merged,
    total,
    limit: limit || 100,
    offset: offset || 0,
  });
});

export const getChargeSummary = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const sources = await ApiSource.find({ assignedUsers: req.user._id, isActive: true }).select("name").lean();

  if (sources.length === 0) {
    return res.json({ today: 0, month: 0 });
  }

  const sourceNames = sources.map((s) => s.name);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const [todayResult, monthResult] = await Promise.all([
    OrderCharge.aggregate([
      { $match: { source: { $in: sourceNames }, orderDate: today } },
      { $group: { _id: null, total: { $sum: "$chargeAmount" } } },
    ]),
    OrderCharge.aggregate([
      { $match: { source: { $in: sourceNames }, orderDate: { $regex: `^${monthPrefix}` } } },
      { $group: { _id: null, total: { $sum: "$chargeAmount" } } },
    ]),
  ]);

  return res.json({
    today: todayResult[0]?.total || 0,
    month: monthResult[0]?.total || 0,
  });
});

export const getWalletOverview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const today = new Date().toISOString().slice(0, 10);

  let tradeWallet = await TradeWallet.findOne({ user: req.user._id });
  if (!tradeWallet) {
    tradeWallet = await TradeWallet.create({ user: req.user._id, balance: 0 });
  }

  // The summary's charges/profit/loss track how much of today's totals have
  // already been applied to the wallet. Each call only applies the delta
  // since the last call, then advances those fields to the new totals — this
  // way a wallet swap that happens between polls (which mutates
  // tradeWallet.balance directly) is never clobbered by re-basing off a
  // stale start-of-day balance.
  let summary = await WalletDailySummary.findOne({ user: req.user._id, date: today });
  if (!summary) {
    summary = await WalletDailySummary.create({
      user: req.user._id,
      date: today,
      oldBalance: tradeWallet.balance ?? 0,
      charges: 0,
      profit: 0,
      loss: 0,
      newBalance: tradeWallet.balance ?? 0,
    });
  }

  const applied = { charges: summary.charges, profit: summary.profit, loss: summary.loss };

  const sources = await ApiSource.find({ assignedUsers: req.user._id, isActive: true }).lean();
  const sourceNames = sources.map((s) => s.name);

  let totalCharges = 0;
  let totalProfit = 0;
  let totalLoss = 0;

  if (sourceNames.length > 0) {
    const [chargeResult, tradeResults] = await Promise.all([
      OrderCharge.aggregate([
        { $match: { source: { $in: sourceNames }, orderDate: today } },
        { $group: { _id: null, total: { $sum: "$chargeAmount" } } },
      ]),
      Promise.allSettled(
        sources.map((source) =>
          fetchTradesFromSource({ baseUrl: source.baseUrl, apiKey: source.apiKey, authHeader: source.authHeader })
        )
      ),
    ]);

    totalCharges = round2(chargeResult[0]?.total || 0);

    if (tradeResults.every((r) => r.status === "fulfilled")) {
      const trades: ExternalTrade[] = [];
      tradeResults.forEach((r) => {
        if (r.status === "fulfilled") trades.push(...r.value.data);
      });
      ({ profit: totalProfit, loss: totalLoss } = realisedTotals(trades, today));
    } else {
      // A trade source could not be reached: keep the P&L already applied
      // rather than treating the missing trades as a drop to zero.
      totalProfit = applied.profit;
      totalLoss = applied.loss;
    }
  }

  // Apply the signed change since the last refresh (no ratchet): see
  // services/walletOverview.service.ts for the rules.
  const netDelta = balanceDelta(applied, { charges: totalCharges, profit: totalProfit, loss: totalLoss });

  if (netDelta !== 0) {
    tradeWallet.balance = round2((tradeWallet.balance ?? 0) + netDelta);
    await tradeWallet.save();
  }

  summary.charges = totalCharges;
  summary.profit = totalProfit;
  summary.loss = totalLoss;
  summary.newBalance = tradeWallet.balance;
  await summary.save();

  return res.json({
    oldBalance: summary.oldBalance,
    charges: totalCharges,
    profit: totalProfit,
    loss: totalLoss,
    newBalance: tradeWallet.balance,
  });
});
