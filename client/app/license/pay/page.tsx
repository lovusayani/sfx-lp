"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, QrCode } from "lucide-react";

import { refreshLicenseStatus, useLicense } from "@/components/license/licenseStore";
import { AuthLayout } from "@/components/sfx/AuthLayout";
import { Alert, Button, ButtonLink, Chip, Display } from "@/components/sfx/ui";

/** Default QR shipped with the app; the sheet's qr_url column overrides it. */
const DEFAULT_QR = "/license/qr.png";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sfx-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">{label}</p>
        <p className="truncate text-[15px] font-medium text-sfx-text">{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked — the value is visible to copy by hand
          }
        }}
        className="flex shrink-0 items-center gap-1 rounded-full bg-sfx-gold-soft px-3 py-1.5 text-[11px] font-semibold text-sfx-accent"
        aria-label={`Copy ${label}`}
      >
        <Copy size={12} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function LicensePayPage() {
  const { info } = useLicense();
  const [qrFailed, setQrFailed] = useState(false);
  const [notified, setNotified] = useState(false);

  // After "I've paid", check more often so the unlock shows up quickly.
  useEffect(() => {
    if (!notified) return;
    const t = setInterval(() => void refreshLicenseStatus(), 15_000);
    return () => clearInterval(t);
  }, [notified]);

  const qrSrc = info?.qrUrl || DEFAULT_QR;

  if (info && !info.locked) {
    return (
      <AuthLayout>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 size={72} strokeWidth={1.3} className="text-sfx-success" />
          <Display title="Payment confirmed." subtitle="All features are unlocked. Thank you." />
          <ButtonLink href="/">Continue</ButtonLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Chip className="self-start">API PAYMENT</Chip>
      <Display title="Complete the API payment." subtitle="Scan the QR code with your payment app. Access unlocks automatically once the payment is confirmed." />

      <div className="sfx-card flex flex-col items-center gap-4 p-6">
        {!qrFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt="Payment QR code"
            width={260}
            height={332}
            onError={() => setQrFailed(true)}
            className="h-auto w-[260px] max-w-full rounded-[18px] bg-white object-contain p-2"
          />
        ) : (
          <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 rounded-[18px] bg-sfx-surface-2 text-sfx-muted">
            <QrCode size={48} />
            <span className="text-[12px]">QR code not available — use the details below</span>
          </div>
        )}
        {info?.amount && (
          <p className="text-[28px] font-bold text-sfx-accent">
            {info.amount} <span className="text-[16px] font-semibold text-sfx-muted">{info.currency}</span>
          </p>
        )}
      </div>

      <div className="sfx-tile px-[21px] py-1">
        {info?.payTo && <CopyRow label="Pay to" value={info.payTo} />}
        {info?.reference && <CopyRow label="Payment reference" value={info.reference} />}
      </div>
      {info?.note && <p className="text-[13px] text-sfx-muted">{info.note}</p>}
      <p className="text-[12px] text-sfx-muted">Please include the payment reference in the payment note so it can be matched quickly.</p>

      {notified ? (
        <Alert tone="info">Thank you. We&rsquo;ll confirm your payment shortly — this page updates automatically.</Alert>
      ) : (
        <Button onClick={() => setNotified(true)}>I&rsquo;ve paid</Button>
      )}
    </AuthLayout>
  );
}
