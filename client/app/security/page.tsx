"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Fingerprint, Mail, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { cn } from "@/components/sfx/cn";
import { OtpInput } from "@/components/sfx/OtpInput";
import { Alert, Button, Chip, Display, Field, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { disableTotp, enableTotp, setTwoFactorEmail, startTotpSetup } from "@/services/auth.service";
import { getNextRoute } from "@/services/session.service";

type Method = "authenticator" | "email" | "biometric";

const METHODS: Array<{ id: Method; title: string; sub: string; detail?: string; icon: LucideIcon }> = [
  {
    id: "authenticator",
    title: "Authenticator app",
    sub: "Most secure • recommended",
    detail: "Google Authenticator, Microsoft Authenticator, Authy or similar give you a new code every 30 seconds.",
    icon: Smartphone,
  },
  { id: "email", title: "Email verification", sub: "Codes sent to your inbox", icon: Mail },
  { id: "biometric", title: "Biometric unlock", sub: "Coming soon", icon: Fingerprint },
];

const CTA: Record<Method, string> = {
  authenticator: "Set up authenticator app",
  email: "Continue with email",
  biometric: "Continue with biometrics",
};

/** Figma: DARK / 10 Two-factor authentication — choose and set up a sign-in check. */
export default function SecurityPage() {
  const router = useRouter();
  const { user, setUser } = useHydratedUser();
  const [method, setMethod] = useState<Method>("authenticator");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const done = () => router.replace(user ? getNextRoute(user) : "/");

  const onContinue = async () => {
    setError("");
    setNotice("");
    if (!user) return router.push("/login");
    if (method === "biometric") return setNotice("Biometric unlock is coming soon. Choose another method for now.");
    setBusy(true);
    try {
      if (method === "email") {
        setUser(await setTwoFactorEmail(true));
        setNotice(`Done. We'll email a code to ${user.email} each time you sign in.`);
        setTimeout(done, 1400);
        return;
      }
      const s = await startTotpSetup();
      setSetup({ secret: s.secret, qr: s.qr });
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const confirmTotp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return setError("Enter the six-digit code from the app.");
    setBusy(true);
    setError("");
    try {
      setUser(await enableTotp(code));
      setSetup(null);
      setNotice("Authenticator app is on. You'll enter a code from it each time you sign in.");
      setTimeout(done, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
      setCode("");
      setBusy(false);
    }
  };

  const turnOff = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 && !password) return setError("Enter a code from your app or your password.");
    setBusy(true);
    setError("");
    try {
      setUser(await disableTotp(code.length === 6 ? { code } : { password }));
      setCode("");
      setPassword("");
      setNotice("Authenticator app is off.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn it off.");
    } finally {
      setBusy(false);
    }
  };

  /* Already protected with an authenticator: offer to turn it off. */
  if (user?.totpEnabled && !setup) {
    return (
      <AuthLayout>
        <TopBar caption="ACCOUNT SECURITY" />
        <Chip className="self-start" tone="success">
          PROTECTED
        </Chip>
        <Display title="Authenticator app is on." subtitle="Each sign-in asks for a code from your authenticator app." />
        <div className="sfx-tile flex items-center gap-3 p-4">
          <ShieldCheck size={22} className="shrink-0 text-sfx-accent" />
          <p className="text-[13px] text-sfx-muted">To turn it off, enter a current code from the app — or your password if you lost the phone.</p>
        </div>
        <form onSubmit={turnOff} className="flex flex-col gap-3.5">
          <OtpInput value={code} onChange={setCode} />
          <Field label="Or your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
          <Button type="submit" variant="secondary" loading={busy}>
            Turn off authenticator
          </Button>
        </form>
        <button type="button" onClick={done} className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text">
          Back
        </button>
      </AuthLayout>
    );
  }

  /* Step 2 of the authenticator setup: scan, then confirm a code. */
  if (setup) {
    return (
      <AuthLayout>
        <TopBar caption="AUTHENTICATOR APP" />
        <Display title="Scan this code." subtitle="Open your authenticator app, tap “+” and scan. Then type the 6-digit code it shows." />
        <div className="sfx-card flex flex-col items-center gap-3 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code for your authenticator app" className="h-48 w-48 rounded-[10px] bg-white p-2" />
          <p className="text-[12px] text-sfx-muted">Can&apos;t scan? Enter this key in the app:</p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(setup.secret).then(() => setNotice("Key copied."), () => undefined)}
            className="inline-flex max-w-full items-center gap-2 rounded-[10px] bg-sfx-surface-2 px-3 py-2 font-mono text-[12px] tracking-wider text-sfx-text"
            title="Copy key"
          >
            <span className="break-all">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</span>
            <Copy size={14} className="shrink-0 text-sfx-accent" />
          </button>
        </div>
        <form onSubmit={confirmTotp} className="flex flex-col gap-3.5">
          <OtpInput value={code} onChange={setCode} />
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
          <Button type="submit" loading={busy}>
            Confirm and turn on
          </Button>
        </form>
        <button
          type="button"
          onClick={() => (setSetup(null), setCode(""), setError(""))}
          className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text"
        >
          Cancel
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <TopBar caption="ACCOUNT SECURITY" />
      <Chip className="self-start">RECOMMENDED</Chip>
      <Display title="Add another layer of safety." subtitle="Choose how you would like to confirm sensitive actions." />

      <div role="radiogroup" aria-label="Verification method" className="flex flex-col gap-3">
        {METHODS.map((m) => {
          const active = method === m.id;
          const Icon = m.icon;
          const on = (m.id === "email" && user?.twoFactorEmail) || false;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col gap-3 rounded-[14px] border p-4 text-left transition",
                active ? "border-sfx-border-strong bg-sfx-gold-soft/40" : "border-sfx-line bg-sfx-surface-2 hover:border-sfx-border"
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    active ? "bg-sfx-gold text-sfx-on-gold" : "bg-sfx-gold-soft text-sfx-accent"
                  )}
                >
                  <Icon size={18} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-semibold text-sfx-text">{m.title}</span>
                  <span className="text-[12px] text-sfx-muted">{m.sub}</span>
                </span>
                {on && <Chip tone="success">ON</Chip>}
              </span>
              {active && m.detail && <span className="text-[12px] text-sfx-muted">{m.detail}</span>}
            </button>
          );
        })}
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      <Button onClick={onContinue} loading={busy} className="mt-1" disabled={method === "email" && Boolean(user?.twoFactorEmail)}>
        {method === "email" && user?.twoFactorEmail ? "Email codes are already on" : CTA[method]}
      </Button>
      <button type="button" onClick={done} className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text">
        Set this up later
      </button>
    </AuthLayout>
  );
}
