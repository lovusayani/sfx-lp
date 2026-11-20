"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

import { ActivityItem, ActivityKind, loadActivity } from "@/components/sfx/activity";
import { ActivityList, EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { Chip, Display, TopBar } from "@/components/sfx/ui";

const FILTERS: Array<{ id: "all" | ActivityKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Deposits" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "transfer", label: "Transfers" },
];

/** Full transaction history (Figma bottom-bar "History"). */
export default function HistoryPage() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");

  useEffect(() => {
    loadActivity().then(setItems, () => setItems([]));
  }, []);

  const shown = useMemo(() => (items || []).filter((i) => filter === "all" || i.kind === filter), [items, filter]);

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar
        backHref="/dashboard"
        right={
          <Link
            href="/dashboard/performance"
            className="inline-flex items-center gap-1.5 rounded-[12px] bg-sfx-gold-soft px-3 py-1.5 text-[12px] font-semibold text-sfx-accent hover:brightness-110"
          >
            <TrendingUp size={13} /> Trade results
          </Link>
        }
      />
      <Display size="md" title="Account activity" subtitle="Every deposit, withdrawal and wallet transfer, newest first." />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <Chip key={f.id} as="button" tone={filter === f.id ? "gold" : "neutral"} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {items === null ? (
        <Skeleton className="h-[260px]" />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Your transactions will appear here as soon as you make them." />
      ) : (
        <ActivityList items={shown} showDates />
      )}
    </div>
  );
}
