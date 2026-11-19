"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { GoldHero } from "@/components/sfx/Hero";
import { Alert, Button, Chip, Display, TopBar } from "@/components/sfx/ui";
import { formatMoney } from "@/components/sfx/format";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getNextRoute } from "@/services/session.service";
import { completeOnboarding } from "@/services/user.service";

/**
 * Figma: DARK / 02–04 Onboarding (Account, Transfers, Security).
 * Signed out: an introduction that ends at Sign in.
 * Signed in (first login): completes onboarding on the server, then continues to KYC.
 */
const SLIDES = [
  {
    eyebrow: "YOUR ACCOUNT",
    title: "A better view of your funds.",
    body: "Balances, account activity and reports in one refined dashboard.",
    cta: "Continue",
  },
  {
    eyebrow: "MOVE WITH CLARITY",
    title: "Funds, without the friction.",
    body: "Review transfers, deposits, withdrawals and transaction history.",
    cta: "Continue",
  },
  {
    eyebrow: "BUILT AROUND TRUST",
    title: "Confidence at every step.",
    body: "Stay informed with authentication, KYC and account alerts.",
    cta: "Start securely",
  },
] as const;

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading, user } = useHydratedUser();
  const initial = Math.min(Math.max(Number(params.get("step")) || 0, 0), SLIDES.length - 1);
  const [index, setIndex] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    if (user.mustChangePassword || user.onboardingCompleted) router.replace(getNextRoute(user));
  }, [loading, router, user]);

  const finish = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await completeOnboarding();
      router.replace("/kyc");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not continue. Please try again.");
      setSubmitting(false);
    }
  };

  const next = () => (index < SLIDES.length - 1 ? setIndex(index + 1) : finish());
  const back = () => (index > 0 ? setIndex(index - 1) : router.push(user ? "/login" : "/welcome"));
  const slide = SLIDES[index];

  return (
    <AuthLayout key={index}>
      <TopBar onBack={back} caption={`0${index + 1} / 0${SLIDES.length}`} />
      <Chip className="self-start">{slide.eyebrow}</Chip>
      <div className="h-1" />

      {index === 0 && <GoldHero caption="Everything in one place" step={0} onStep={setIndex} />}
      {index === 1 && <BalancePreview />}
      {index === 2 && <SecurityPreview />}

      <Display title={slide.title} subtitle={slide.body} />
      {error && <Alert>{error}</Alert>}
      <Button onClick={next} loading={submitting} className="mt-2">
        {slide.cta}
      </Button>
      {index === 0 && (
        <button
          type="button"
          onClick={finish}
          disabled={submitting}
          className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text"
        >
          Skip introduction
        </button>
      )}
    </AuthLayout>
  );
}

/** Figma 2:72 — illustrative balance card (sample figures, not account data). */
function BalancePreview() {
  return (
    <div className="sfx-card flex min-h-[315px] flex-col justify-center gap-4 px-[21px] py-8" aria-label="Example balance card">
      <p className="text-[12px] font-medium tracking-[0.08em] text-sfx-muted">TOTAL BALANCE</p>
      <p className="text-[38px] font-bold leading-none text-sfx-accent">{formatMoney(95467)}</p>
      <p className="text-[13px] text-sfx-text">
        Available balance&nbsp;&nbsp;{formatMoney(5467)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>
          <ArrowUpRight size={12} /> Send
        </Chip>
        <Chip>
          <ArrowDownLeft size={12} /> Receive
        </Chip>
        <Chip>
          <ArrowLeftRight size={12} /> Swap
        </Chip>
      </div>
    </div>
  );
}

/** Figma 2:98 — security emblem card. */
function SecurityPreview() {
  return (
    <div className="sfx-card flex min-h-[306px] flex-col items-center justify-center gap-4 px-[21px] text-center">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden className="text-sfx-accent">
        <rect x="23" y="23" width="50" height="50" rx="2" transform="rotate(45 48 48)" fill="none" stroke="currentColor" strokeWidth="6" />
        <rect x="37" y="37" width="22" height="22" rx="1.5" transform="rotate(45 48 48)" fill="currentColor" />
      </svg>
      <p className="text-[13px] font-semibold tracking-[0.1em] text-sfx-accent">SECURITY FIRST</p>
      <p className="text-[15px] text-sfx-text">Verified access and protected account activity.</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
