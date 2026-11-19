"use client";

import Link from "next/link";
import { ReactNode, TextareaHTMLAttributes, useEffect, useId } from "react";
import { ChevronRight, ShieldAlert, X, type LucideIcon } from "lucide-react";

import { cn } from "./cn";
import { Chip } from "./ui";

/* ── Status chip for deposits / withdrawals / KYC ───────────────────── */

const STATUS: Record<string, { label: string; tone: "gold" | "neutral" | "success" | "danger" }> = {
  pending: { label: "PENDING", tone: "neutral" },
  processing: { label: "PROCESSING", tone: "neutral" },
  approved: { label: "COMPLETED", tone: "success" },
  completed: { label: "COMPLETED", tone: "success" },
  rejected: { label: "REJECTED", tone: "danger" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status.toUpperCase(), tone: "neutral" as const };
  return (
    <Chip tone={s.tone} className={cn("px-2.5 py-1.5 text-[10px]", className)}>
      {s.label}
    </Chip>
  );
}

/* ── Bottom sheet on phones, centred dialog on larger screens ───────── */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sfx fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="sfx-enter sfx-safe-bottom relative w-full max-w-[480px] rounded-t-[28px] border border-sfx-border bg-sfx-surface-solid px-6 pb-6 pt-5 sm:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sfx-line sm:hidden" aria-hidden />
        <div className="mb-5 flex items-center justify-between">
          <h2 id={id} className="text-[19px] font-semibold text-sfx-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Multi-line field matching Field ────────────────────────────────── */

export function TextArea({
  label,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">
        {label}
      </label>
      <textarea
        id={id}
        className="min-h-[96px] rounded-[14px] border border-sfx-line bg-sfx-field px-[17px] py-3 text-[14px] text-sfx-text placeholder:text-sfx-muted/70 focus:border-sfx-gold focus:outline-none"
        {...rest}
      />
    </div>
  );
}

/* ── Selectable option card (deposit method, network…) ─────────────── */

export function OptionCard({
  selected,
  disabled,
  onClick,
  title,
  body,
  icon: Icon,
  badge,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  body?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left transition",
        selected ? "border-sfx-gold bg-sfx-gold-soft/50" : "border-sfx-line bg-sfx-surface-2 hover:border-sfx-border-strong",
        disabled && "cursor-not-allowed opacity-45 hover:border-sfx-line"
      )}
    >
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
          <Icon size={17} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-sfx-text">{title}</span>
        {body && <span className="block text-[12px] text-sfx-muted">{body}</span>}
      </span>
      {badge}
      <span
        aria-hidden
        className={cn(
          "h-[18px] w-[18px] shrink-0 rounded-full border-2",
          selected ? "border-sfx-gold bg-sfx-gold shadow-[inset_0_0_0_3px_var(--sfx-surface-solid)]" : "border-sfx-border-strong"
        )}
      />
    </button>
  );
}

/* ── On/off switch ─────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-[14px] text-sfx-text">{label}</span>
        {description && <span className="block text-[12px] text-sfx-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          "relative h-[26px] w-[44px] shrink-0 rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-sfx-gold",
          checked ? "border-sfx-gold bg-sfx-gold" : "border-sfx-line bg-sfx-surface-2"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-[20px] w-[20px] -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[20px] bg-sfx-on-gold" : "left-[2px] bg-sfx-muted"
          )}
        />
      </span>
    </label>
  );
}

/* ── Segmented control (theme, direction…) ─────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[16px] border border-sfx-line bg-sfx-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 flex-1 rounded-[12px] text-[13px] font-medium transition",
            value === o.value ? "bg-sfx-gold text-sfx-on-gold" : "text-sfx-muted hover:text-sfx-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Menu list (profile, more…) ────────────────────────────────────── */

export function MenuList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("sfx-card divide-y divide-sfx-line px-[21px] py-1", className)}>{children}</ul>;
}

export function MenuRow({
  href,
  onClick,
  icon: Icon,
  label,
  value,
  danger,
}: {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  value?: ReactNode;
  danger?: boolean;
}) {
  const inner = (
    <>
      <Icon size={18} className={danger ? "text-sfx-danger" : "text-sfx-accent"} aria-hidden />
      <span className={cn("flex-1 text-[14px]", danger ? "text-sfx-danger" : "text-sfx-text")}>{label}</span>
      {value && <span className="text-[12px] text-sfx-muted">{value}</span>}
      {!danger && <ChevronRight size={16} className="text-sfx-muted" aria-hidden />}
    </>
  );
  const cls = "flex w-full items-center gap-3 py-3.5 text-left";
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

/* ── Notice shown when KYC is not approved yet ─────────────────────── */

export function KycGate({ status }: { status?: string }) {
  const pending = status === "pending";
  return (
    <div className="sfx-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
        <ShieldAlert size={22} />
      </span>
      <p className="text-[16px] font-semibold text-sfx-text">{pending ? "Verification in review" : "Verify your identity first"}</p>
      <p className="max-w-xs text-[13px] text-sfx-muted">
        {pending
          ? "Deposits and withdrawals unlock as soon as your documents are approved."
          : "Deposits and withdrawals are available once your identity is verified."}
      </p>
      <Link
        href={pending ? "/kyc/status" : "/kyc"}
        className="mt-1 rounded-[30px] bg-sfx-gold-soft px-4 py-2 text-[12px] font-semibold text-sfx-accent hover:brightness-110"
      >
        {pending ? "Check status" : "Start verification"}
      </Link>
    </div>
  );
}

/* ── Plain-text CMS content (support, help, about) ─────────────────── */

const URL_RE = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.]+)/g;

const linkify = (line: string) =>
  line.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part.includes("@") && !part.startsWith("http") ? `mailto:${part}` : part}
        target={part.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className="text-sfx-accent underline-offset-2 hover:underline"
      >
        {part}
      </a>
    ) : (
      part
    )
  );

export function RichText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4">
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-sfx-text/90">
          {para.split("\n").map((line, j, arr) => (
            <span key={j}>
              {linkify(line)}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

/* ── Simple pager ──────────────────────────────────────────────────── */

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn =
    "h-9 rounded-[12px] border border-sfx-line px-4 text-[12px] font-semibold text-sfx-text hover:border-sfx-border-strong disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center justify-between">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-[12px] text-sfx-muted">
        Page {page} of {pages}
      </span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
