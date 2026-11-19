"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getChargeSummary, getTrades, getWalletOverview, SuimfxTrade, WalletOverview } from "@/services/trades.service";

import { EmptyState, Skeleton } from "./ActivityList";
import { cn } from "./cn";
import { formatMoney } from "./format";
import { Pager } from "./kit";
import { Alert, Chip, SectionTitle, TopBar } from "./ui";

const TABS = [
  { href: "/dashboard/brokerview", label: "Overview" },
  { href: "/dashboard/brokerview/open", label: "Open" },
  { href: "/dashboard/brokerview/close", label: "Closed" },
];

const POLL_MS = 5 * 60 * 1000;
const sameDay = (iso: string | null, ref = new Date()) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
};
const sameMonth = (iso: string | null, ref = new Date()) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};
const num = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const when = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Header + tab strip shared by the three trade screens. */
export function TradeHeader() {
  const pathname = usePathname();
  return (
    <>
      <TopBar backHref="/dashboard" caption="TRADE" />
      <h1 className="text-[24px] font-bold text-sfx-text md:text-[28px]">Trading</h1>
      <nav aria-label="Trade sections" className="flex gap-2">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-[30px] px-4 py-2 text-[12px] font-semibold transition",
                active ? "bg-sfx-gold text-sfx-on-gold" : "bg-sfx-surface-2 text-sfx-muted hover:text-sfx-text"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Overview: today's trade-wallet reconciliation and activity tiles. Polls every 5 min (drives charge sync). */
export function TradeOverview() {
  const [trades, setTrades] = useState<SuimfxTrade[] | null>(null);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [charges, setCharges] = useState<{ today: number; month: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.allSettled([getTrades({ status: "all", limit: 500 }), getWalletOverview(), getChargeSummary()]).then(([t, o, c]) => {
        if (!alive) return;
        setTrades(t.status === "fulfilled" ? t.value.data : []);
        setOverview(o.status === "fulfilled" ? o.value : null);
        setCharges(c.status === "fulfilled" ? c.value : { today: 0, month: 0 });
      });
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const s = useMemo(() => {
    const all = trades || [];
    const today = all.filter((t) => sameDay(t.open_datetime) || sameDay(t.close_datetime));
    const month = all.filter((t) => sameMonth(t.open_datetime) || sameMonth(t.close_datetime));
    const sum = (list: SuimfxTrade[], k: keyof SuimfxTrade) => list.reduce((a, t) => a + (Number(t[k]) || 0), 0);
    return {
      lots: sum(today, "lot_size"),
      accounts: new Set(today.map((t) => t.username)).size,
      volumeToday: sum(today, "open_amount"),
      volumeMonth: sum(month, "open_amount"),
      pnlToday: sum(today, "pnl"),
      pnlMonth: sum(month, "pnl"),
      open: all.filter((t) => t.status === "Open").length,
      closedToday: all.filter((t) => t.status === "Closed" && sameDay(t.close_datetime)).length,
      margin: sum(today, "used_margin"),
    };
  }, [trades]);

  const loading = trades === null;
  const net = overview ? overview.profit - overview.loss - overview.charges : 0;

  return (
    <div className="grid gap-[19px] lg:grid-cols-[1.15fr_1fr] lg:items-start">
      <section className="sfx-card flex flex-col gap-4 p-[21px]" aria-label="Trade wallet today">
        <p className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">TRADE WALLET TODAY</p>
        {loading ? (
          <Skeleton className="h-11 w-56" />
        ) : overview ? (
          <>
            <p className="text-[38px] font-bold leading-tight tracking-tight text-sfx-accent tabular-nums md:text-[44px]">
              {formatMoney(overview.newBalance)}
            </p>
            <p className="text-[13px]">
              <span className={net >= 0 ? "text-sfx-accent" : "text-sfx-danger"}>
                {net >= 0 ? "↑" : "↓"} {formatMoney(net, { sign: true })}
              </span>{" "}
              <span className="text-sfx-muted">since opening {formatMoney(overview.oldBalance)}</span>
            </p>
            <dl className="grid grid-cols-3 gap-2 border-t border-sfx-line pt-4 text-[12px]">
              <Recon label="Profit" value={formatMoney(overview.profit)} tone="text-sfx-success" />
              <Recon label="Loss" value={formatMoney(-overview.loss)} tone="text-sfx-danger" />
              <Recon label="Charges" value={formatMoney(-overview.charges)} tone="text-sfx-muted" />
            </dl>
          </>
        ) : (
          <p className="text-[13px] text-sfx-muted">Your trade account isn’t linked yet. Results will appear here once trading starts.</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Tile label="P&L TODAY" value={loading ? null : formatMoney(s.pnlToday, { sign: true })} sub={`Month ${formatMoney(s.pnlMonth, { sign: true })}`} accent />
        <Tile label="VOLUME TODAY" value={loading ? null : formatMoney(s.volumeToday, { decimals: 0 })} sub={`Month ${formatMoney(s.volumeMonth, { decimals: 0 })}`} />
        <Tile label="OPEN POSITIONS" value={loading ? null : String(s.open)} href="/dashboard/brokerview/open" />
        <Tile label="CLOSED TODAY" value={loading ? null : String(s.closedToday)} href="/dashboard/brokerview/close" />
        <Tile label="LOTS TODAY" value={loading ? null : num(s.lots)} />
        <Tile label="MARGIN USED" value={loading ? null : formatMoney(s.margin, { decimals: 0 })} />
        <Tile label="CHARGES TODAY" value={charges ? formatMoney(charges.today) : null} sub={charges ? `Month ${formatMoney(charges.month)}` : undefined} />
        <Tile label="ACTIVE ACCOUNTS" value={loading ? null : String(s.accounts)} />
      </div>
    </div>
  );
}

function Recon({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <dt className="text-sfx-muted">{label}</dt>
      <dd className={cn("mt-1 font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function Tile({ label, value, sub, accent, href }: { label: string; value: string | null; sub?: string; accent?: boolean; href?: string }) {
  const body = (
    <>
      <p className="text-[11px] font-medium tracking-[0.06em] text-sfx-muted">{label}</p>
      {value === null ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <p className={cn("text-[19px] font-semibold tabular-nums", accent ? "text-sfx-accent" : "text-sfx-text")}>{value}</p>
      )}
      {sub && <p className="text-[11px] text-sfx-muted tabular-nums">{sub}</p>}
    </>
  );
  const cls = "sfx-tile flex flex-col gap-2 p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-sfx-border-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const PAGE = 12;

/** Open or closed positions: search, side filter, cards on phones and a table on desktop. */
export function PositionList({ status }: { status: "open" | "closed" }) {
  const [rows, setRows] = useState<SuimfxTrade[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"all" | "Buy" | "Sell">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getTrades({ status, limit: 500 }).then(
      (r) => setRows(r.data),
      (e) => {
        setRows([]);
        setError(e instanceof Error ? e.message : "Could not load positions.");
      }
    );
  }, [status]);

  const timeOf = (t: SuimfxTrade) => (status === "closed" ? t.close_datetime || t.open_datetime : t.open_datetime);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || [])
      .filter((t) => side === "all" || t.position === side)
      .filter((t) => !q || [t.symbol, t.username, t.source].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(timeOf(b) || 0).getTime() - new Date(timeOf(a) || 0).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, side]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE, current * PAGE);
  const totalPnl = filtered.reduce((a, t) => a + (t.pnl || 0), 0);

  return (
    <section className="flex flex-col gap-4" aria-label={status === "open" ? "Open positions" : "Closed positions"}>
      <SectionTitle
        action={
          rows && rows.length > 0 ? (
            <span className={cn("text-[13px] font-semibold tabular-nums", totalPnl >= 0 ? "text-sfx-accent" : "text-sfx-danger")}>
              {formatMoney(totalPnl, { sign: true })}
            </span>
          ) : null
        }
      >
        {status === "open" ? "Open positions" : "Closed positions"}
      </SectionTitle>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex h-[42px] flex-1 items-center gap-2 rounded-[14px] border border-sfx-line bg-sfx-field px-4 focus-within:border-sfx-gold">
          <Search size={15} className="text-sfx-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => (setQuery(e.target.value), setPage(1))}
            placeholder="Search symbol or account"
            aria-label="Search positions"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-sfx-text placeholder:text-sfx-muted/70 focus:outline-none"
          />
        </label>
        <div className="flex gap-2" role="group" aria-label="Side">
          {(["all", "Buy", "Sell"] as const).map((s) => (
            <Chip key={s} as="button" tone={side === s ? "gold" : "neutral"} active={side === s} onClick={() => (setSide(s), setPage(1))}>
              {s === "all" ? "All" : s}
            </Chip>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {rows === null ? (
        <Skeleton className="h-[260px]" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? (status === "open" ? "No open positions" : "No closed positions yet") : "No matches"}
          body={rows.length === 0 ? "Positions from your linked trade account appear here." : "Try a different search or filter."}
        />
      ) : (
        <>
          {/* Phones & tablets: cards */}
          <ul className="sfx-card divide-y divide-sfx-line px-[21px] py-2 lg:hidden">
            {shown.map((t) => (
              <li key={t.trade_id} className="flex items-center gap-3 py-3.5">
                <SideBadge side={t.position} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-sfx-text">
                    {t.symbol} <span className="text-[12px] font-normal text-sfx-muted">· {num(t.lot_size || 0)} lots</span>
                  </p>
                  <p className="truncate text-[11px] text-sfx-muted">
                    {when(timeOf(t))} · {t.username}
                  </p>
                </div>
                <span className={cn("shrink-0 text-[14px] font-medium tabular-nums", t.pnl >= 0 ? "text-sfx-accent" : "text-sfx-danger")}>
                  {formatMoney(t.pnl, { sign: true })}
                </span>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="sfx-card hidden overflow-x-auto p-2 lg:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-sfx-muted">
                  {["Symbol", "Side", "Lots", "Open", status === "closed" ? "Close" : "Margin", "P/L", status === "closed" ? "Closed" : "Opened", "Account"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sfx-line">
                {shown.map((t) => (
                  <tr key={t.trade_id} className="text-sfx-text">
                    <td className="px-4 py-3 font-medium">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <SideBadge side={t.position} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{num(t.lot_size || 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(t.open_amount)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {status === "closed" ? (t.close_amount === null ? "—" : num(t.close_amount)) : num(t.used_margin || 0)}
                    </td>
                    <td className={cn("px-4 py-3 font-medium tabular-nums", t.pnl >= 0 ? "text-sfx-accent" : "text-sfx-danger")}>
                      {formatMoney(t.pnl, { sign: true })}
                    </td>
                    <td className="px-4 py-3 text-sfx-muted">{when(timeOf(t))}</td>
                    <td className="px-4 py-3 text-sfx-muted">{t.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={current} pages={pages} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function SideBadge({ side }: { side: "Buy" | "Sell" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-11 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-semibold",
        side === "Buy" ? "bg-sfx-success/15 text-sfx-success" : "bg-sfx-danger/15 text-sfx-danger"
      )}
    >
      {side.toUpperCase()}
    </span>
  );
}
