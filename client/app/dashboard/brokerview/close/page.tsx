"use client";

import { PositionList, TradeHeader } from "@/components/sfx/trade";

export default function ClosedPositionsPage() {
  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TradeHeader />
      <PositionList status="closed" />
    </div>
  );
}
