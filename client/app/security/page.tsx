"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Mail, Smartphone, type LucideIcon } from "lucide-react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { cn } from "@/components/sfx/cn";
import { Alert, Button, Chip, Display, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { setTwoFactorEmail } from "@/services/auth.service";
import { getNextRoute } from "@/services/session.service";

type Method = "authenticator" | "email" | "biometric";

const METHODS: Array<{ id: Method; title: string; sub: string; detail?: string; icon: LucideIcon }> = [
  {
    id: "authenticator",
    title: "Authenticator app",
    sub: "Most secure • recommended",
    detail: "Use a rotating code from your authenticator app.",
    icon: Smartphone,
  },
  { id: "email", title: "Email verification", sub: "Codes sent to your inbox", icon: Mail },
  { id: "biometric", title: "Biometric unlock", sub: "When supported on your device", icon: Fingerprint },
];

const CTA: Record<Method, string> = {
  authenticator: "Continue with authenticator",
  email: "Continue with email",
  biometric: "Continue with biometrics",
};

/** Figma: DARK / 10 Two-factor authentication */
export default function SecurityPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("authenticator");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useHydratedUser();

  const onContinue = async () => {
    setError("");
    setNotice("");
    if (method !== "email") {
      // Authenticator apps and biometrics need more backend work; email codes work today.
      setNotice("This method is coming soon. Choose Email verification to protect your account now.");
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      await setTwoFactorEmail(true);
      setNotice(`Done. We'll email a code to ${user.email} each time you sign in.`);
      setTimeout(() => router.replace(getNextRoute(user)), 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on email codes.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <TopBar caption="ACCOUNT SECURITY" />
      <Chip className="self-start">RECOMMENDED</Chip>
      <Display title="Add another layer of safety." subtitle="Choose how you would like to confirm sensitive actions." />

      <div role="radiogroup" aria-label="Verification method" className="flex flex-col gap-[19px]">
        {METHODS.map((m) => {
          const active = method === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col gap-3 rounded-[22px] border p-[21px] text-left transition",
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
                <span className="flex flex-col">
                  <span className="text-[16px] font-semibold text-sfx-text">{m.title}</span>
                  <span className="text-[12px] text-sfx-muted">{m.sub}</span>
                </span>
              </span>
              {active && m.detail && <span className="text-[12px] text-sfx-muted">{m.detail}</span>}
            </button>
          );
        })}
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      <Button onClick={onContinue} loading={busy} className="mt-1">
        {CTA[method]}
      </Button>
      <button
        type="button"
        onClick={() => router.replace(user ? getNextRoute(user) : "/")}
        className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text"
      >
        Set this up later
      </button>
    </AuthLayout>
  );
}
