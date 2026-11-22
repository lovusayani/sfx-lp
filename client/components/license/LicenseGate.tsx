"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { LicenseInfo, useLicense } from "./licenseStore";

/** Sections that stay locked while the API payment is pending. */
const LOCKED_PATHS = ["/admin/trading/charges", "/admin/trading/sources", "/dashboard/brokerview"];
// Admin → Settings → Deposit wallets is a tab, locked with <LicenseSectionLock /> inside that tab.

/**
 * Global, non-closable "API Payment Pending" notice.
 * Shown on locked sections, and anywhere the API refuses a request because payment is pending
 * (for example a second user signing in). The only action is to go to the payment page.
 */
export function LicenseGate() {
  const pathname = usePathname() || "/";
  const { info, forced } = useLicense();

  const onPayPage = pathname.startsWith("/license");
  const onLockedPath = LOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const show = !onPayPage && Boolean(info?.locked || forced) && (forced || onLockedPath);
  if (!show) return null;
  const isAdmin = pathname.startsWith("/admin");
  return <LicenseModal info={info} admin={isAdmin} leaveHref={isAdmin ? "/admin" : undefined} leaveLabel="Back to admin" />;
}

/** Locks one section of a page (e.g. a settings tab) while payment is pending. */
export function LicenseSectionLock({ onLeave, leaveLabel }: { onLeave?: () => void; leaveLabel?: string }) {
  const { info } = useLicense();
  if (!info?.locked) return null;
  return <LicenseModal info={info} admin onLeave={onLeave} leaveLabel={leaveLabel} />;
}

function LicenseModal({
  info,
  admin,
  leaveHref,
  onLeave,
  leaveLabel,
}: {
  info: LicenseInfo | null;
  admin: boolean;
  leaveHref?: string;
  onLeave?: () => void;
  leaveLabel?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const show = true;

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    // Not closable: swallow Escape so no underlying handler dismisses anything.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [show]);

  const isAdmin = admin;

  return (
    <div className="sfx fixed inset-0 z-[2147483000] flex items-center justify-center p-6" style={{ background: "rgba(5,5,4,0.72)", backdropFilter: "blur(10px)" }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="license-title"
        aria-describedby="license-body"
        className="sfx-card sfx-enter flex w-full max-w-[400px] flex-col items-center gap-4 p-7 text-center outline-none"
        style={{ background: "var(--sfx-surface-solid)" }}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
          <LockKeyhole size={30} />
        </span>
        <h2 id="license-title" className="text-[22px] font-bold text-sfx-text">
          API Payment Pending
        </h2>
        <p id="license-body" className="text-[14px] leading-relaxed text-sfx-muted">
          {isAdmin
            ? "This section is unavailable until the API payment is completed."
            : "This feature is unavailable until the API payment is completed."}
        </p>
        {info?.amount && (
          <p className="text-[13px] text-sfx-text">
            Amount due:{" "}
            <span className="font-semibold text-sfx-accent">
              {info.amount} {info.currency}
            </span>
          </p>
        )}
        <Link
          href="/license/pay"
          className="mt-2 inline-flex h-[54px] w-full items-center justify-center rounded-[17px] border border-sfx-border-strong bg-sfx-gold text-[15px] font-semibold text-sfx-on-gold"
        >
          Pay now
        </Link>
        {/* Leaving the locked page is allowed; dismissing the notice is not. */}
        {leaveHref && (
          <Link href={leaveHref} className="text-[13px] font-medium text-sfx-muted hover:text-sfx-text">
            {leaveLabel || "Go back"}
          </Link>
        )}
        {onLeave && (
          <button type="button" onClick={onLeave} className="text-[13px] font-medium text-sfx-muted hover:text-sfx-text">
            {leaveLabel || "Go back"}
          </button>
        )}
        {info?.reference && <p className="text-[11px] tracking-wide text-sfx-muted">Reference {info.reference}</p>}
      </div>
    </div>
  );
}
