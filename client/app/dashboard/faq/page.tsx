"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { cn } from "@/components/sfx/cn";
import { Display, TopBar } from "@/components/sfx/ui";
import { getPageContent } from "@/services/user.service";

interface FaqItem {
  q: string;
  a: string;
}

const parseFaq = (raw: string): FaqItem[] => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((i) => i && typeof i.q === "string" && typeof i.a === "string");
  } catch {
    // not JSON — no entries
  }
  return [];
};

/** FAQ (Admin → Page setup, JSON list of {q, a}). */
export default function FaqPage() {
  const [title, setTitle] = useState("FAQ");
  const [items, setItems] = useState<FaqItem[] | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getPageContent("faq").then(
      (d) => {
        setTitle(d.title || "FAQ");
        setItems(parseFaq(d.content));
      },
      () => setItems([])
    );
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).map((item, i) => ({ item, i })).filter(({ item }) => !q || `${item.q} ${item.a}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar caption="FAQ" />
      <Display size="md" title={title} subtitle="Quick answers to the questions we hear most." />
      {items && items.length > 4 && (
        <label className="flex h-[42px] max-w-[720px] items-center gap-2 rounded-[10px] border border-sfx-line bg-sfx-field px-4 focus-within:border-sfx-gold">
          <Search size={15} className="text-sfx-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions"
            aria-label="Search questions"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-sfx-text placeholder:text-sfx-muted/70 focus:outline-none"
          />
        </label>
      )}
      {items === null ? (
        <Skeleton className="h-[260px]" />
      ) : shown.length === 0 ? (
        <EmptyState title={items.length ? "No matching questions" : "No questions yet"} body="Can’t find what you need? Contact support." />
      ) : (
        <ul className="sfx-card max-w-[720px] divide-y divide-sfx-line px-4 py-1">
          {shown.map(({ item, i }) => {
            const isOpen = open === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 py-4 text-left"
                >
                  <span className="flex-1 text-[14px] font-medium text-sfx-text">{item.q}</span>
                  <ChevronDown size={17} className={cn("shrink-0 text-sfx-muted transition", isOpen && "rotate-180 text-sfx-accent")} />
                </button>
                {isOpen && <p className="-mt-1 pb-4 text-[13px] leading-relaxed text-sfx-muted whitespace-pre-line">{item.a}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[13px] text-sfx-muted">
        Still stuck?{" "}
        <Link href="/dashboard/support" className="font-semibold text-sfx-accent">
          Contact support
        </Link>
      </p>
    </div>
  );
}
