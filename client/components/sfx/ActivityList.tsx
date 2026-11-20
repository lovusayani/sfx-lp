import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";

import { ActivityItem } from "./activity";
import { cn } from "./cn";
import { formatDate, formatMoney } from "./format";

const ICONS = { deposit: ArrowUpRight, withdrawal: ArrowDownLeft, transfer: ArrowLeftRight } as const;

const isMuted = (item: ActivityItem) => ["pending", "processing", "rejected", "cancelled"].includes(item.status);

/** Activity card (Figma 2:416): icon, label, signed amount. */
export function ActivityList({ items, showDates, className }: { items: ActivityItem[]; showDates?: boolean; className?: string }) {
  return (
    <ul className={cn("sfx-card sfx-stagger divide-y divide-sfx-line px-4 py-2", className)}>
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        const muted = isMuted(item);
        return (
          <li key={item.id} className="flex items-center gap-3 py-3.5">
            <Icon size={16} className={muted ? "text-sfx-muted" : "text-sfx-text"} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[14px]", muted ? "text-sfx-muted" : "text-sfx-text")}>{item.title}</p>
              {showDates && (
                <p className="text-[11px] text-sfx-muted">
                  {[formatDate(item.createdAt), item.detail].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 text-[14px] font-medium tabular-nums",
                muted ? "text-sfx-muted" : item.amount > 0 && item.kind !== "transfer" ? "text-sfx-accent" : "text-sfx-text"
              )}
            >
              {item.kind === "transfer" ? formatMoney(item.amount) : formatMoney(item.amount, { sign: true })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyState({ title, body, className }: { title: string; body?: string; className?: string }) {
  return (
    <div className={cn("sfx-card flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
      <p className="text-[15px] font-semibold text-sfx-text">{title}</p>
      {body && <p className="max-w-xs text-[13px] text-sfx-muted">{body}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[14px] bg-sfx-surface-2", className)} aria-hidden />;
}
