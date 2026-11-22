"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, QrCode, Smartphone } from "lucide-react";

import { refreshLicenseStatus, useLicense } from "@/components/license/licenseStore";
import { AuthLayout } from "@/components/sfx/AuthLayout";
import { Alert, Button, ButtonLink, Chip, Display, Field } from "@/components/sfx/ui";

/** Default QR shipped with the app; the sheet's qr_url column overrides it. */
const DEFAULT_QR = "/license/qr.png";

const isUpiId = (v: string) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.trim());

/** Standard UPI payment link (works with any UPI app); amount and note are pre-filled. */
// The UPI ID keeps its literal "@" (some UPI apps reject "%40"); other values are URL-encoded.
const upiLink = (payTo: string, payName: string, amount: string, note: string) => {
  const parts = [`pa=${payTo.trim()}`];
  if (payName) parts.push(`pn=${encodeURIComponent(payName)}`);
  if (amount) parts.push(`am=${amount}`);
  parts.push("cu=INR");
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${parts.join("&")}`;
};

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
  const [amountInput, setAmountInput] = useState("");
  const [dynamicQr, setDynamicQr] = useState("");

  const fixedAmount = (info?.amount || "").replace(/[^\d.]/g, "");
  const currency = info?.currency || "INR";
  const upi = Boolean(info?.payTo && isUpiId(info.payTo) && currency.toUpperCase() === "INR");
  const amount = fixedAmount || (/^\d+(\.\d{1,2})?$/.test(amountInput) && Number(amountInput) > 0 ? Number(amountInput).toFixed(2) : "");
  const link = useMemo(
    () => (upi && info ? upiLink(info.payTo, info.payName || "", amount, info.reference) : ""),
    [upi, info, amount]
  );

  // Build a QR for the exact amount the client entered (static QR is used until then).
  useEffect(() => {
    let alive = true;
    if (!link || !amount) {
      const t = setTimeout(() => alive && setDynamicQr(""), 0);
      return () => clearTimeout(t);
    }
    QRCode.toDataURL(link, { margin: 1, width: 520, errorCorrectionLevel: "M" }).then(
      (url) => alive && setDynamicQr(url),
      () => alive && setDynamicQr("")
    );
    return () => {
      alive = false;
    };
  }, [link, amount]);

  // After "I've paid", check more often so the unlock shows up quickly.
  useEffect(() => {
    if (!notified) return;
    const t = setInterval(() => void refreshLicenseStatus(), 15_000);
    return () => clearInterval(t);
  }, [notified]);

  const qrSrc = dynamicQr || info?.qrUrl || DEFAULT_QR;

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
      <Display title="Complete the API payment." subtitle="Enter the amount, then scan the QR code with any UPI app. Access unlocks once the payment is confirmed." />

      {!fixedAmount && (
        <Field
          label={`Amount (${currency})`}
          inputMode="decimal"
          placeholder="Enter the amount you are paying"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ""))}
          hint={amount ? "The QR code below now includes this amount." : "You can also scan without an amount and type it in your UPI app."}
        />
      )}

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
        {amount && (
          <p className="text-[28px] font-bold text-sfx-accent">
            {Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
            <span className="text-[16px] font-semibold text-sfx-muted">{currency}</span>
          </p>
        )}
        {link && (
          <a
            href={link}
            className="inline-flex items-center gap-2 rounded-full bg-sfx-gold-soft px-4 py-2 text-[13px] font-semibold text-sfx-accent md:hidden"
          >
            <Smartphone size={15} /> Pay with UPI app
          </a>
        )}
      </div>

      <div className="sfx-tile px-[21px] py-1">
        {info?.payTo && <CopyRow label="Pay to" value={info.payTo} />}
        {info?.reference && <CopyRow label="Payment reference" value={info.reference} />}
      </div>
      {info?.note && <p className="text-[13px] text-sfx-muted">{info.note}</p>}
      <p className="text-[12px] text-sfx-muted">Please include the payment reference in the payment note so it can be matched quickly.</p>

      {amount && <p className="text-[12px] text-sfx-muted">Amount entered: {amount} {currency}. Pay exactly this amount so it can be confirmed quickly.</p>}
      {notified ? (
        <Alert tone="info">Thank you. We&rsquo;ll confirm your payment shortly — this page updates automatically.</Alert>
      ) : (
        <Button onClick={() => setNotified(true)}>I&rsquo;ve paid</Button>
      )}
    </AuthLayout>
  );
}
