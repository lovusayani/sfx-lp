"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { formatDate } from "@/components/sfx/format";
import { Sheet } from "@/components/sfx/kit";
import { Alert, Display, Spinner, TopBar } from "@/components/sfx/ui";
import { getMyNoticeById, getMyNotices, NoticeListItem } from "@/services/user.service";

/** Notices from the desk. Opening one marks it read. */
export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeListItem[] | null>(null);
  const [selected, setSelected] = useState<NoticeListItem | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyNotices().then(setNotices, (e) => {
      setNotices([]);
      setError(e instanceof Error ? e.message : "Could not load notices.");
    });
  }, []);

  const open = async (n: NoticeListItem) => {
    setOpening(n.id);
    setError("");
    try {
      const full = await getMyNoticeById(n.id);
      setSelected(full);
      setNotices((prev) => (prev || []).map((x) => (x.id === full.id ? { ...x, read: true } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this notice.");
    } finally {
      setOpening(null);
    }
  };

  const unread = (notices || []).filter((n) => !n.read).length;

  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TopBar caption="NOTICES" />
      <Display size="md" title="Notices" subtitle={unread ? `${unread} unread` : "Updates and announcements from Swiss Liquidity."} />
      {error && <Alert>{error}</Alert>}
      {notices === null ? (
        <Skeleton className="h-[240px]" />
      ) : notices.length === 0 ? (
        <EmptyState title="You’re all caught up" body="New announcements will appear here." />
      ) : (
        <ul className="sfx-card max-w-[720px] divide-y divide-sfx-line px-[21px] py-1">
          {notices.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                disabled={Boolean(opening)}
                className="flex w-full items-start gap-3 py-3.5 text-left disabled:cursor-wait"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    n.read ? "bg-sfx-surface-2 text-sfx-muted" : "bg-sfx-gold-soft text-sfx-accent"
                  )}
                >
                  {opening === n.id ? <Spinner /> : <Bell size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[14px]", n.read ? "text-sfx-text/80" : "font-semibold text-sfx-text")}>
                    {n.title}
                  </span>
                  <span className="block truncate text-[12px] text-sfx-muted">{n.message}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-sfx-muted">{formatDate(n.createdAt)}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-sfx-gold" aria-label="Unread" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || ""}>
        <p className="mb-4 text-[12px] text-sfx-muted">{selected ? new Date(selected.createdAt).toLocaleString("en-GB") : ""}</p>
        <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-sfx-text/90">{selected?.message}</p>
      </Sheet>
    </div>
  );
}
