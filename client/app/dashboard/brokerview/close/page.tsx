"use client";

import { PositionList, TradeHeader } from "@/components/sfx/trade";

export default function ClosedPositionsPage() {
  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TradeHeader />
      <PositionList status="closed" />
    </div>
  );
}
