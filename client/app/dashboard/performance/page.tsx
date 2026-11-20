"use client";

import { useEffect, useState } from "react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { formatMoney } from "@/components/sfx/format";
import { Pager } from "@/components/sfx/kit";
import { Display, TopBar } from "@/components/sfx/ui";
import { getMyTradeLogs, UserTradeLogRecord } from "@/services/user.service";

const PAGE_SIZE = 12;

/** Performance: daily trade results posted by the desk, newest first. */
export default function PerformancePage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: UserTradeLogRecord[]; pages: number; total: number } | null>(null);

  useEffect(() => {
    let alive = true;
    getMyTradeLogs(page, PAGE_SIZE).then(
      (r) => alive && setData({ rows: r.records, pages: r.totalPages || 1, total: r.total || 0 }),
      () => alive && setData({ rows: [], pages: 1, total: 0 })
    );
    return () => {
      alive = false;
    };
  }, [page]);

  const pagePnl = (data?.rows || []).reduce((a, r) => a + (r.trade_type === "profit" ? 1 : -1) * Math.abs(Number(r.profit || 0)), 0);

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar backHref="/dashboard/history" caption="PERFORMANCE" />
      <Display size="md" title="Performance" subtitle="Results of each trade on your account and the trade-wallet balance after it." />

      {data && data.total > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="sfx-tile flex flex-col gap-2 p-4">
            <p className="text-[11px] font-medium tracking-[0.06em] text-sfx-muted">TRADES</p>
            <p className="text-[19px] font-semibold tabular-nums text-sfx-text">{data.total}</p>
          </div>
          <div className="sfx-tile flex flex-col gap-2 p-4">
            <p className="text-[11px] font-medium tracking-[0.06em] text-sfx-muted">RESULT ON THIS PAGE</p>
            <p className={cn("text-[19px] font-semibold tabular-nums", pagePnl >= 0 ? "text-sfx-accent" : "text-sfx-danger")}>
              {formatMoney(pagePnl, { sign: true })}
            </p>
          </div>
        </div>
      )}

      {data === null ? (
        <Skeleton className="h-[320px]" />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No results yet" body="Trade results appear here once trading on your account starts." />
      ) : (
        <>
          <ul className="sfx-card divide-y divide-sfx-line px-4 py-2">
            {data.rows.map((r) => {
              const profit = r.trade_type === "profit";
              const value = Math.abs(Number(r.profit || 0));
              return (
                <li key={r.id} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-sfx-text">{r.trade_pair}</p>
                    <p className="truncate text-[11px] text-sfx-muted">
                      {[r.trade_date, r.trade_time].filter(Boolean).join(" ")} · Size {formatMoney(Number(r.trade_val || 0))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-[14px] font-medium tabular-nums", profit ? "text-sfx-accent" : "text-sfx-danger")}>
                      {formatMoney(profit ? value : -value, { sign: true })}
                    </p>
                    <p className="text-[11px] tabular-nums text-sfx-muted">Bal {formatMoney(Number(r.curr_trade_bal || 0))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pager page={page} pages={data.pages} onPage={(p) => (setData(null), setPage(p))} />
        </>
      )}
    </div>
  );
}
