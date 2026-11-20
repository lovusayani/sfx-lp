"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Diamond,
  FileText,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo, Credit } from "@/components/sfx/Brand";
import { cn } from "@/components/sfx/cn";
import { Spinner } from "@/components/sfx/ui";
import { useBranding } from "@/components/sfx/useBranding";
import { setAdminTheme, useAdminTheme } from "@/components/theme/FrontendThemeController";

/* ── Navigation (Aurum admin: 10 sections) ─────────────────────────── */

export const ADMIN_NAV: Array<{ href: string; label: string; icon: LucideIcon; match?: string[] }> = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/kyc", label: "KYC Reviews", icon: ShieldCheck },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowDownLeft },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpRight },
  { href: "/admin/trading", label: "Trading", icon: BarChart3 },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/notices", label: "Notices", icon: Bell },
  { href: "/admin/audit", label: "Activity log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const isActive = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

function BrandMark({ compact }: { compact?: boolean }) {
  const { shortName, darkLogo, lightLogo, mobileLogo } = useBranding();
  const hasLogo = Boolean(darkLogo || lightLogo || mobileLogo);
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3 text-sfx-text" aria-label="Admin home">
      {hasLogo ? (
        <span className="flex min-w-0 flex-col gap-1">
          <BrandLogo height={compact ? 22 : 34} compact={compact} />
          {!compact && <span className="text-[10px] font-bold tracking-[0.16em] text-sfx-muted">ADMIN CONSOLE</span>}
        </span>
      ) : (
        <>
          <Diamond size={26} className="shrink-0 text-sfx-gold" strokeWidth={2.2} />
          {!compact && (
            <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.04em]">
              {shortName.toUpperCase()} <span className="text-sfx-muted">/</span> ADMIN
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function NavItem({ item, active, compact, onNavigate }: { item: (typeof ADMIN_NAV)[number]; active: boolean; compact?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={cn(
        "flex h-[40px] items-center gap-3 rounded-[10px] text-[14px] transition-colors",
        compact ? "justify-center px-0" : "px-3.5",
        active
          ? "bg-sfx-gold-soft font-semibold text-sfx-text [&_svg]:text-sfx-accent"
          : "text-sfx-muted hover:bg-sfx-surface-2 hover:text-sfx-text"
      )}
    >
      <Icon size={17} className="shrink-0" />
      {!compact && <span className="truncate">{item.label}</span>}
      {compact && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

/* Sidebar collapsed/expanded preference, shared by every admin page. */
const SIDEBAR_KEY = "sfx_admin_sidebar";
const SIDEBAR_EVENT = "sfx-admin-sidebar";
const readCollapsed = (): boolean => {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    if (v === "collapsed") return true;
    if (v === "expanded") return false;
  } catch {
    // storage unavailable
  }
  return !window.matchMedia("(min-width: 1280px)").matches;
};
const subscribeSidebar = (cb: () => void) => {
  window.addEventListener(SIDEBAR_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const setCollapsed = (collapsed: boolean) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
};

/** Dark / light / system for the admin panel itself (the app's theme is set in Settings → Appearance). */
export function AdminThemeToggle({ className }: { className?: string }) {
  const theme = useAdminTheme();
  const options: Array<{ value: "light" | "dark" | "system"; icon: LucideIcon; label: string }> = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div role="radiogroup" aria-label="Admin theme" className={cn("flex items-center rounded-[10px] bg-sfx-surface-2 p-1", className)}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${o.label} theme`}
            onClick={() => setAdminTheme(o.value)}
            className={cn(
              "flex h-[30px] w-[32px] items-center justify-center rounded-[8px] transition",
              active ? "bg-sfx-surface-solid text-sfx-accent shadow-sm" : "text-sfx-muted hover:text-sfx-text"
            )}
          >
            <Icon size={15} />
            <span className="sr-only">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Admin frame (Figma "Aurum / Admin").
 * Tablet & desktop: sidebar that collapses to an icon rail with the toggle; while collapsed it
 * slides open on hover and hides again when the pointer leaves. Phone: top bar + slide-in menu.
 */
export function AdminShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [peek, setPeek] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
  const wide = !collapsed || peek;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const footer = (
    <div className="mt-auto flex flex-col gap-3 px-1 pt-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.06em] text-sfx-accent">SYSTEM ADMIN</p>
        <p className="text-[11px] text-sfx-muted">Secure console • v1.1</p>
      </div>
      <Credit className="text-left" />
    </div>
  );

  return (
    <div className="sfx sfx-page flex min-h-[100dvh]">
      {/* Tablet & desktop sidebar: the outer box reserves the rail/full width; the panel can overlay on hover. */}
      <div className={cn("relative hidden shrink-0 transition-[width] duration-300 ease-out md:block", collapsed ? "w-[72px]" : "w-[248px]")}>
        <aside
          onMouseEnter={() => collapsed && setPeek(true)}
          onMouseLeave={() => setPeek(false)}
          className={cn(
            "fixed left-0 top-0 z-40 flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden border-r border-sfx-line bg-[var(--sfx-sidebar)] py-6 transition-[width,box-shadow] duration-300 ease-out",
            wide ? "w-[248px] px-4" : "w-[72px] px-2.5",
            collapsed && peek && "shadow-2xl"
          )}
        >
          <div className={cn("flex items-center gap-2", wide ? "justify-between" : "flex-col")}>
            <BrandMark compact={!wide} />
            <button
              type="button"
              onClick={() => (setCollapsed(!collapsed), setPeek(false))}
              aria-label={collapsed ? "Keep sidebar open" : "Collapse sidebar"}
              title={collapsed ? "Keep sidebar open" : "Collapse sidebar"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-sfx-muted transition hover:bg-sfx-surface-2 hover:text-sfx-text"
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
          <div className="my-5 h-px bg-sfx-line" />
          <nav aria-label="Admin" className="flex flex-col gap-1.5">
            {ADMIN_NAV.map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href, pathname)} compact={!wide} />
            ))}
          </nav>
          {wide && footer}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sfx-line bg-sfx-bg/90 px-4 backdrop-blur md:hidden">
          <BrandMark />
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-sfx-text hover:bg-sfx-surface-2"
          >
            <Menu size={20} />
          </button>
        </div>
        <main key={pathname} className="sfx-page-in mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 md:px-7 md:py-8 xl:px-10">
          {header}
          {children}
        </main>
        <Credit className="pb-4 md:hidden" />
      </div>

      {/* Phone drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <div className="sfx-enter absolute inset-y-0 left-0 flex w-[270px] flex-col overflow-y-auto bg-[var(--sfx-sidebar)] px-5 py-6">
            <div className="flex items-center justify-between">
              <BrandMark />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted">
                <X size={18} />
              </button>
            </div>
            <div className="my-5 h-px bg-sfx-line" />
            <nav aria-label="Admin" className="flex flex-col gap-1.5">
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.href} item={item} active={isActive(item.href, pathname)} onNavigate={() => setDrawer(false)} />
              ))}
            </nav>
            <AdminThemeToggle className="mt-5 self-start" />
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page header: title + subtitle, session pill, account menu ─────── */

/** The layout puts the signed-in admin's account menu here so every page header shows it. */
export const AdminAccountSlot = createContext<ReactNode>(null);

export function PageHeader({
  title,
  subtitle,
  actions,
  account,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  account?: ReactNode;
}) {
  const { appName } = useBranding();
  const slot = useContext(AdminAccountSlot);
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight text-sfx-text md:text-[30px]">{title}</h1>
        <p className="mt-1 text-[13px] text-sfx-muted">{subtitle ?? `${appName} • Administration workspace`}</p>
      </div>
      <div className="flex items-center gap-2.5">
        {actions}
        <AdminThemeToggle className="hidden md:flex" />
        <span className="hidden items-center gap-2 rounded-[14px] bg-sfx-surface-2 px-3.5 py-2.5 text-[13px] text-sfx-text sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-sfx-success" aria-hidden /> Secure session
        </span>
        {account ?? slot}
      </div>
    </header>
  );
}

export function AccountMenu({ initials, onChangePassword, onSignOut }: { initials: string; onChangePassword: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-[42px] items-center gap-1.5 rounded-[14px] bg-sfx-gold px-3.5 text-[13px] font-bold text-sfx-on-gold"
      >
        {initials} <span aria-hidden className="text-[9px]">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[50px] z-40 w-[210px] overflow-hidden rounded-[16px] border border-sfx-border bg-sfx-surface-solid py-1.5 shadow-xl">
          <button
            type="button"
            role="menuitem"
            onClick={() => (setOpen(false), onChangePassword())}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-sfx-text hover:bg-sfx-surface-2"
          >
            <KeyRound size={15} className="text-sfx-gold" /> Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => (setOpen(false), onSignOut())}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-sfx-danger hover:bg-sfx-surface-2"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Stat cards ────────────────────────────────────────────────────── */

export function StatGrid({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 }) {
  return (
    <div className={cn("mb-6 grid gap-4", cols === 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  noteTone = "success",
  caps,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: "success" | "danger" | "gold" | "muted";
  caps?: boolean;
}) {
  const tones = { success: "text-sfx-success", danger: "text-sfx-danger", gold: "text-sfx-gold", muted: "text-sfx-muted" };
  return (
    <div className="rounded-[24px] border border-sfx-line bg-sfx-surface-2/60 px-5 py-6">
      <p className={cn("text-[12px] text-sfx-muted", caps && "uppercase tracking-[0.04em]")}>{label}</p>
      <p className={cn("mt-2 text-[28px] font-bold leading-tight tabular-nums", caps ? "text-sfx-text" : "text-sfx-gold")}>{value}</p>
      {note && <p className={cn("mt-2 text-[12px]", tones[noteTone])}>{note}</p>}
    </div>
  );
}

/* ── Panel (Figma "… activity" cards) ──────────────────────────────── */

export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-[24px] border border-sfx-line bg-sfx-surface-2/40 p-5 md:p-6", className)}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-semibold text-sfx-text">{title}</h2>}
          {aside && <div className="flex flex-wrap items-center gap-3 text-[13px] text-sfx-muted">{aside}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function OpsNote({ children }: { children?: ReactNode }) {
  return (
    <Panel title="Operations note" aside="Admin controls" className="mt-6">
      <p className="text-[13px] text-sfx-muted">
        {children ?? "Review details before approval. Sensitive actions are recorded and cannot be undone from this screen."}
      </p>
    </Panel>
  );
}

/* ── Filter chips ──────────────────────────────────────────────────── */

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label = "Filter",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-[34px] rounded-[12px] px-3.5 text-[13px] font-medium transition",
            value === o.value ? "bg-sfx-gold text-sfx-on-gold" : "bg-sfx-surface-2 text-sfx-text hover:brightness-125"
          )}
        >
          {o.label}
          {typeof o.count === "number" && <span className="ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Status pill ───────────────────────────────────────────────────── */

const PILL: Record<string, { label: string; tone: "gold" | "neutral" | "danger" }> = {
  active: { label: "Active", tone: "gold" },
  approved: { label: "Approved", tone: "gold" },
  completed: { label: "Completed", tone: "gold" },
  verified: { label: "Verified", tone: "gold" },
  pending: { label: "Pending", tone: "neutral" },
  processing: { label: "Processing", tone: "neutral" },
  not_submitted: { label: "Not submitted", tone: "neutral" },
  open: { label: "Open", tone: "gold" },
  answered: { label: "Answered", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "danger" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const p = PILL[status] ?? { label: status, tone: "neutral" as const };
  return (
    <span
      className={cn(
        "inline-flex h-[34px] min-w-[76px] items-center justify-center whitespace-nowrap rounded-[12px] px-3 text-[13px] font-medium",
        p.tone === "gold" && "bg-sfx-gold text-sfx-on-gold",
        p.tone === "neutral" && "bg-sfx-surface-2 text-sfx-text",
        p.tone === "danger" && "bg-sfx-danger/15 text-sfx-danger"
      )}
    >
      {label ?? p.label}
    </span>
  );
}

/* ── Activity rows (title/sub · middle · pill · View ↗) ────────────── */

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-sfx-line">{children}</ul>;
}

export function Row({
  title,
  sub,
  middle,
  middleSub,
  status,
  onView,
  viewLabel = "View",
  trailing,
}: {
  title: ReactNode;
  sub?: ReactNode;
  middle?: ReactNode;
  middleSub?: ReactNode;
  status?: ReactNode;
  onView?: () => void;
  viewLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] md:py-5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-sfx-text">{title}</p>
        {sub && <p className="mt-0.5 truncate text-[13px] text-sfx-muted">{sub}</p>}
      </div>
      <div className="order-3 col-span-2 min-w-0 text-[14px] text-sfx-text/90 tabular-nums md:order-none md:col-span-1">
        {middle}
        {middleSub && <p className="truncate text-[12px] text-sfx-muted">{middleSub}</p>}
      </div>
      <div className="justify-self-end">{status}</div>
      <div className="hidden justify-self-end md:block">
        {trailing ??
          (onView && (
            <button type="button" onClick={onView} className="inline-flex items-center gap-1 text-[14px] font-semibold text-sfx-gold hover:underline">
              {viewLabel} <ArrowUpRight size={14} />
            </button>
          ))}
      </div>
      {onView && !trailing && (
        <button type="button" onClick={onView} className="order-4 col-span-2 -mt-1 justify-self-start text-[13px] font-semibold text-sfx-gold md:hidden">
          {viewLabel} ↗
        </button>
      )}
    </li>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────── */

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-sfx-gold text-sfx-on-gold hover:brightness-105",
  secondary: "bg-sfx-surface-2 text-sfx-text hover:brightness-125",
  danger: "bg-sfx-danger/15 text-sfx-danger hover:bg-sfx-danger/25",
  ghost: "text-sfx-muted hover:text-sfx-text",
};

export function Btn({
  children,
  variant = "primary",
  loading,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        "inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/* ── Dialog ────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
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
    <div className="sfx fixed inset-0 z-[200] flex items-end justify-center bg-transparent sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          "sfx-enter relative flex max-h-[92dvh] w-full flex-col rounded-t-[26px] border border-sfx-border bg-sfx-surface-solid sm:rounded-[26px]",
          wide ? "sm:max-w-[760px]" : "sm:max-w-[480px]"
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sfx-line px-6 py-4">
          <h2 id={id} className="min-w-0 truncate text-[17px] font-semibold text-sfx-text">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-surface-2">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="sfx-safe-bottom flex flex-wrap justify-end gap-2 border-t border-sfx-line px-6 pt-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Detail list (label / value) ───────────────────────────────────── */

export function DetailList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="divide-y divide-sfx-line rounded-[16px] border border-sfx-line px-4 text-[13px]">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-sfx-muted">{k}</dt>
          <dd className="min-w-0 break-words text-right text-sfx-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Search box ────────────────────────────────────────────────────── */

export function SearchBox({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-[34px] w-[200px] rounded-[12px] border border-sfx-line bg-sfx-field px-3 text-[13px] text-sfx-text placeholder:text-sfx-muted/70 focus:border-sfx-gold focus:outline-none"
    />
  );
}

/* ── Sub-navigation tabs (Trading, Reports, Settings) ─────────────── */

export function SubTabs({ tabs }: { tabs: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Section" className="mb-6 flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "h-[36px] rounded-[12px] px-4 text-[13px] font-medium leading-[36px] transition",
              active ? "bg-sfx-gold text-sfx-on-gold" : "bg-sfx-surface-2 text-sfx-text hover:brightness-125"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */

export const money = (n: number | undefined | null, decimals = 2) =>
  `${Number(n || 0) < 0 ? "−" : ""}$${Math.abs(Number(n || 0)).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const compactMoney = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}K` : a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${n < 0 ? "−" : ""}$${s}`;
};

export const ago = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const shortId = (prefix: string, id: string) => `${prefix}-${id.slice(-5).toUpperCase()}`;

/** Download rows as CSV (Export ↗). */
export function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] text-sfx-muted hover:text-sfx-text">
      Export <ArrowUpRight size={13} />
    </button>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[64px] animate-pulse rounded-[16px] bg-sfx-surface-2" />
      ))}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-12 text-center">
      <p className="text-[15px] font-semibold text-sfx-text">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-sfx-muted">{body}</p>}
    </div>
  );
}
