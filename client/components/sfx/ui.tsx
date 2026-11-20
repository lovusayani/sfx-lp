"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ButtonHTMLAttributes,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  useState,
} from "react";

import { cn } from "./cn";

/* ── Buttons (Figma "Action •" / "Secondary •") ─────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "relative inline-flex w-full select-none items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "h-[54px] border border-sfx-border-strong bg-sfx-gold text-sfx-on-gold shadow-[0_12px_26px_-9px_rgba(168,140,49,0.35)] hover:brightness-105",
  secondary: "h-[52px] border border-sfx-border-strong bg-transparent text-[14px] font-medium text-sfx-text hover:bg-sfx-gold-soft/40",
  ghost: "h-11 bg-transparent text-[13px] font-medium text-sfx-muted hover:text-sfx-text",
  danger: "h-[52px] border border-sfx-danger/50 bg-transparent text-[14px] text-sfx-danger hover:bg-sfx-danger/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button ref={ref} className={cn(buttonBase, buttonVariants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

/* ── Chips / pills (Figma pill: #38341c bg, gold 11px semibold) ─────── */

export function Chip({
  children,
  className,
  tone = "gold",
  as: As = "span",
  onClick,
  active,
}: {
  children: ReactNode;
  className?: string;
  tone?: "gold" | "neutral" | "success" | "danger";
  as?: "span" | "button";
  onClick?: () => void;
  active?: boolean;
}) {
  const tones = {
    gold: "bg-sfx-gold-soft text-sfx-accent",
    neutral: "bg-sfx-surface-2 text-sfx-muted",
    success: "bg-sfx-success/15 text-sfx-success",
    danger: "bg-sfx-danger/15 text-sfx-danger",
  } as const;
  return (
    <As
      {...(As === "button" ? { type: "button" as const, onClick } : {})}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[12px] px-3 py-2 text-[11px] font-semibold leading-none tracking-wide",
        tones[tone],
        As === "button" && "transition hover:brightness-110",
        active && "ring-1 ring-sfx-gold",
        className
      )}
    >
      {children}
    </As>
  );
}

/* ── Header row: back arrow + caption (Figma 2:34 pattern) ──────────── */

export function TopBar({
  caption,
  back = true,
  onBack,
  backHref,
  right,
  className,
}: {
  caption?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  backHref?: string;
  right?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <div className={cn("flex h-7 items-center justify-between", className)}>
      {back ? (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-sfx-text hover:bg-sfx-gold-soft/40"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <span />
      )}
      {right ?? (caption ? <span className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">{caption}</span> : null)}
    </div>
  );
}

/* ── Display heading block (Figma "Frame" 326×100: 30px title + 13px body) */

export function Display({
  title,
  subtitle,
  className,
  size = "lg",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  size?: "lg" | "md";
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h1
        className={cn(
          "font-bold leading-[1.18] tracking-[-0.01em] text-sfx-text text-balance",
          size === "lg" ? "text-[30px] md:text-[36px]" : "text-[24px] md:text-[28px]"
        )}
      >
        {title}
      </h1>
      {subtitle && <p className="text-[13px] leading-relaxed text-sfx-muted md:text-[14px]">{subtitle}</p>}
    </div>
  );
}

/* ── Field (Figma "Field •": 11px caps label, 46px input, 17px inset) ── */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, trailing, className, type, id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">
        {label}
      </label>
      <div
        className={cn(
          "flex h-[46px] items-center rounded-[10px] border bg-sfx-field transition focus-within:border-sfx-gold",
          error ? "border-sfx-danger/70" : "border-sfx-line"
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type={isPassword && reveal ? "text" : type}
          className="h-full min-w-0 flex-1 bg-transparent px-[17px] text-[14px] text-sfx-text placeholder:text-sfx-muted/70 focus:outline-none"
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="px-4 text-[11px] font-semibold uppercase tracking-wide text-sfx-muted hover:text-sfx-text"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        )}
        {trailing}
      </div>
      {error ? (
        <p className="text-[12px] text-sfx-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-sfx-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[46px] w-full appearance-none rounded-[10px] border border-sfx-line bg-sfx-field px-[17px] pr-10 text-[14px] text-sfx-text focus:border-sfx-gold focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-sfx-surface-solid">
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sfx-muted">▾</span>
      </div>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-[12px] text-sfx-muted", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="flex h-4 w-4 items-center justify-center rounded-[5px] border border-sfx-border-strong text-[10px] text-sfx-on-gold peer-checked:bg-sfx-gold peer-focus-visible:ring-2 peer-focus-visible:ring-sfx-gold"
      >
        {checked ? "✓" : ""}
      </span>
      <span>{children}</span>
    </label>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────── */

export function Alert({ tone = "danger", children, className }: { tone?: "danger" | "success" | "info"; children: ReactNode; className?: string }) {
  const tones = {
    danger: "border-sfx-danger/40 bg-sfx-danger/10 text-sfx-danger",
    success: "border-sfx-success/40 bg-sfx-success/10 text-sfx-success",
    info: "border-sfx-border bg-sfx-gold-soft/50 text-sfx-text",
  } as const;
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cn("rounded-[10px] border px-4 py-3 text-[13px]", tones[tone], className)}>
      {children}
    </p>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sfx-card p-4", className)}>{children}</div>;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="text-[19px] font-semibold text-sfx-text">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted", className)}>{children}</p>;
}
