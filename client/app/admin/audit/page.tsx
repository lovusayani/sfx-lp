"use client";

import { useEffect, useState } from "react";

import { ago, Empty, exportCsv, ExportLink, FilterChips, Loading, PageHeader, Panel, SearchBox } from "@/components/admin/ui";
import { Pager } from "@/components/sfx/kit";
import { Alert } from "@/components/sfx/ui";
import { adminListAuditLog, AuditEntry } from "@/services/support.service";

const AREAS = ["", "Users", "KYC", "Wallets", "Deposits", "Withdrawals", "Trading", "Reports", "Support", "Notices", "Settings"] as const;
type Area = (typeof AREAS)[number];

/** Admin → Activity log: every change an admin made (kept for a year). */
export default function AdminAuditPage() {
  const [area, setArea] = useState<Area>("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AuditEntry[]; pages: number; total: number } | null>(null);
  const [error, setError] = useState("");

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => (setPage(1), setQ(query.trim())), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    adminListAuditLog({ page, area, q }).then(
      (r) => alive && (setData(r), setError("")),
      (e) => alive && (setData({ items: [], pages: 1, total: 0 }), setError(e instanceof Error ? e.message : "Couldn’t load the log."))
    );
    return () => {
      alive = false;
    };
  }, [page, area, q]);

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every change made in the admin panel, newest first. Kept for 12 months." />
      <Panel
        title="Admin actions"
        aside={
          <>
            <SearchBox value={query} onChange={setQuery} placeholder="Search admin, action, detail" />
            {data && data.items.length > 0 && (
              <ExportLink
                onClick={() =>
                  exportCsv(
                    "activity-log",
                    data.items.map((i) => ({
                      time: new Date(i.createdAt).toISOString(),
                      admin: i.adminEmail,
                      area: i.area,
                      action: i.action,
                      detail: i.detail,
                      target: i.targetId,
                      ip: i.ip,
                    }))
                  )
                }
              />
            )}
          </>
        }
      >
        <FilterChips
          value={area}
          onChange={(v) => (setData(null), setPage(1), setArea(v))}
          label="Area"
          options={AREAS.map((a) => ({ value: a, label: a || "All" }))}
        />
        {error && <Alert className="my-3">{error}</Alert>}
        {data === null ? (
          <Loading rows={6} />
        ) : data.items.length === 0 ? (
          <Empty title="Nothing recorded yet" body="Changes made from now on will show up here." />
        ) : (
          <>
            <ul className="mt-2 divide-y divide-sfx-line">
              {data.items.map((i) => (
                <li key={i.id} className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-4">
                  <div className="text-[12px] text-sfx-muted">
                    <span title={new Date(i.createdAt).toLocaleString()}>{ago(i.createdAt)}</span>
                    <span className="ml-2 rounded-[6px] bg-sfx-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-sfx-text">{i.area}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-sfx-text">{i.action}</p>
                    <p className="truncate text-[12px] text-sfx-muted">{i.adminEmail}</p>
                  </div>
                  <div className="min-w-0 text-[12px] text-sfx-muted">
                    {i.detail && <p className="truncate text-sfx-text/85">{i.detail}</p>}
                    <p className="truncate font-mono">
                      {i.method} {i.path}
                      {i.ip ? ` · ${i.ip}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Pager page={page} pages={data.pages} onPage={(p) => (setData(null), setPage(p))} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
