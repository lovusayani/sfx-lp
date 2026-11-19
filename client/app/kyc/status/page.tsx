"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Clock3 } from "lucide-react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { ButtonLink, Chip, Display, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { KycStatus } from "@/types";

const COPY: Record<KycStatus, { chip: string; tone: "gold" | "success" | "danger" | "neutral"; title: string; body: string; heading: string; sub: string }> = {
  pending: {
    chip: "UNDER REVIEW",
    tone: "gold",
    heading: "Documents submitted",
    sub: "Your verification is being reviewed. We will notify you when the status changes.",
    title: "You’re all set for now.",
    body: "Deposits and withdrawals stay limited until verification is complete.",
  },
  approved: {
    chip: "VERIFIED",
    tone: "success",
    heading: "Identity verified",
    sub: "Thank you. Your account now has full access.",
    title: "You’re fully verified.",
    body: "Deposits, withdrawals and all eligible features are now enabled.",
  },
  rejected: {
    chip: "ACTION NEEDED",
    tone: "danger",
    heading: "Verification declined",
    sub: "We couldn’t verify the documents provided.",
    title: "Let’s try again.",
    body: "Please contact support to understand what needs to change and resubmit.",
  },
  not_submitted: {
    chip: "NOT STARTED",
    tone: "neutral",
    heading: "No documents yet",
    sub: "Verify your identity to unlock deposits and withdrawals.",
    title: "Verification pending.",
    body: "It only takes a few minutes.",
  },
};

/** Figma: DARK / 14 KYC status */
export default function KycStatusPage() {
  const router = useRouter();
  const { loading, user } = useHydratedUser();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const status: KycStatus = user?.kycStatus || "pending";
  const c = COPY[status];
  const Icon = status === "approved" ? CircleCheck : status === "rejected" ? CircleX : Clock3;

  return (
    <AuthLayout>
      <TopBar backHref="/dashboard" caption="VERIFICATION STATUS" />
      <div className="h-3" />
      <Chip tone={c.tone} className="self-start">
        {c.chip}
      </Chip>
      <div className="sfx-card flex min-h-[279px] flex-col items-center justify-center gap-4 px-[21px] text-center">
        <Icon size={72} strokeWidth={1.2} className={status === "rejected" ? "text-sfx-danger" : "text-sfx-accent"} />
        <p className="text-[20px] font-semibold text-sfx-text">{c.heading}</p>
        <p className="max-w-[320px] text-[13px] text-sfx-muted">{c.sub}</p>
      </div>
      <Display title={c.title} subtitle={c.body} />
      {status === "not_submitted" ? (
        <ButtonLink href="/kyc">Begin verification</ButtonLink>
      ) : (
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      )}
      <ButtonLink href="/dashboard/profile/kyc-status" variant="secondary">
        View verification details
      </ButtonLink>
    </AuthLayout>
  );
}
