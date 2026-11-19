"use client";

import { TradeHeader, TradeOverview } from "@/components/sfx/trade";

/** Trade overview: today's trade-wallet result and activity. */
export default function TradePage() {
  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TradeHeader />
      <TradeOverview />
    </div>
  );
}
