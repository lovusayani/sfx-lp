"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  History,
  Home,
  LifeBuoy,
  LogOut,
  Settings,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { logoutUser } from "@/services/auth.service";

import { Wordmark } from "./Brand";
import { cn } from "./cn";

type NavItem = { href: string; label: string; icon: LucideIcon; match?: (p: string) => boolean };

/** Bottom bar from Figma 2:421 — Home, Wallet, Trade, History, Profile. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, match: (p) => p === "/dashboard" },
  {
    href: "/dashboard/wallet",
    label: "Wallet",
    icon: Wallet,
    match: (p) => ["/dashboard/wallet", "/dashboard/deposite", "/dashboard/withdraw"].some((x) => p.startsWith(x)),
  },
  { href: "/dashboard/brokerview", label: "Trade", icon: ArrowLeftRight, match: (p) => p.startsWith("/dashboard/brokerview") },
  {
    href: "/dashboard/history",
    label: "History",
    icon: History,
    match: (p) => p.startsWith("/dashboard/history") || p.startsWith("/dashboard/performance"),
  },
  { href: "/dashboard/profile", label: "Profile", icon: User, match: (p) => p.startsWith("/dashboard/profile") },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/notices", label: "Notices", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

const isActive = (item: NavItem, pathname: string) =>
  item.match ? item.match(pathname) : pathname.startsWith(item.href);

/**
 * Signed-in frame.
 * Phone & tablet: content column + fixed bottom bar (Figma).
 * Desktop (lg+): left sidebar with the same destinations plus secondary links.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await logoutUser().catch(() => undefined);
    router.replace("/login");
  };

  return (
    <div className="sfx sfx-page lg:flex">
      <aside className="sticky top-0 hidden h-[100dvh] w-[248px] shrink-0 flex-col border-r border-sfx-line px-5 py-8 lg:flex">
        <Link href="/dashboard" className="px-3">
          <Wordmark />
        </Link>
        <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(item, pathname)} />
          ))}
        </nav>
        <div className="my-6 h-px bg-sfx-line" />
        <nav className="flex flex-col gap-1" aria-label="More">
          {SECONDARY_NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(item, pathname)} />
          ))}
        </nav>
        <button
          type="button"
          onClick={signOut}
          className="mt-auto flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text"
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mx-auto w-full max-w-[460px] px-8 pt-[34px] md:max-w-[720px] md:px-10 lg:max-w-[1080px] lg:px-12 lg:pt-10">
          {children}
        </div>
      </main>

      <nav
        aria-label="Main"
        className="sfx-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sfx-line bg-sfx-bg/90 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-[720px] items-stretch justify-around px-3 pt-2">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[12px] font-medium",
                    active ? "text-sfx-accent" : "text-sfx-muted hover:text-sfx-text"
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium",
        active ? "bg-sfx-gold-soft text-sfx-accent" : "text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text"
      )}
    >
      <Icon size={18} /> {item.label}
    </Link>
  );
}
