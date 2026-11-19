"use client";

import { useEffect, useState } from "react";

import { Empty, exportCsv, ExportLink, Loading, money, OpsNote, Panel, Pill, Row, Rows, StatCard, StatGrid } from "@/components/admin/ui";
import { Pager } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import { getAdminOrderCharges, OrderChargesPage } from "@/services/admin.service";

const LIMIT = 20;
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Trading → Order report: every broker order that was charged, newest first. */
export default function AdminOrderReportPage() {
  const [data, setData] = useState<OrderChargesPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getAdminOrderCharges(page, LIMIT).then(
      (d) => alive && (setData(d), setError("")),
      (e) => alive && setError(e instanceof Error ? e.message : "Couldn’t load the order report.")
    );
    return () => {
      alive = false;
    };
  }, [page]);

  return (
    <>
      <StatGrid>
        <StatCard label="Charged orders" value={data ? data.total.toLocaleString() : "—"} />
        <StatCard label="Total charges" value={data ? money(data.totalCharge) : "—"} />
        <StatCard label="Showing page" value={data ? `${data.page} / ${Math.max(1, data.totalPages)}` : "—"} />
      </StatGrid>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Panel
        title="Order activity"
        aside={
          <ExportLink
            onClick={() =>
              data &&
              exportCsv(
                `order-report-page-${data.page}.csv`,
                data.records.map((r) => ({
                  trade_id: r.tradeId,
                  source: r.source,
                  account: r.account,
                  symbol: r.symbol,
                  side: r.position,
                  lots: r.lotSize,
                  charge_per_lot: r.chargePerStandardLot,
                  charge: r.chargeAmount,
                  opened: r.openDatetime,
                }))
              )
            }
          />
        }
      >
        {!data && !error ? (
          <Loading />
        ) : !data || data.records.length === 0 ? (
          <Empty title="No charged orders yet" body="Orders pulled from connected API sources appear here once a charge is applied." />
        ) : (
          <>
            <Rows>
              {data.records.map((r) => (
                <Row
                  key={r.id}
                  title={`${r.symbol} · ${r.lotSize} lot${r.lotSize === 1 ? "" : "s"}`}
                  sub={`${r.account} • ${r.source} • #${r.tradeId}`}
                  middle={money(r.chargeAmount)}
                  middleSub={`${money(r.chargePerStandardLot)} / std lot · ${when(r.openDatetime)}`}
                  status={<Pill status={r.position === "Buy" ? "approved" : "pending"} label={r.position} />}
                />
              ))}
            </Rows>
            <div className="mt-4">
              <Pager page={data.page} pages={Math.max(1, data.totalPages)} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <OpsNote>Charges are calculated per standard lot from the Charges tab. Change rates there; use “Recalculate” to apply them to orders already imported.</OpsNote>
    </>
  );
}
