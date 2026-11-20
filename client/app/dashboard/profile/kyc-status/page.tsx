"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { Skeleton } from "@/components/sfx/ActivityList";
import { OpenFileButton, SecureImage } from "@/components/files/SecureFile";
import { Chip, Display, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";

const CHIP = {
  approved: { label: "VERIFIED", tone: "gold" },
  pending: { label: "IN REVIEW", tone: "neutral" },
  rejected: { label: "ACTION NEEDED", tone: "danger" },
} as const;

const DOCS = [
  { key: "companyProof", label: "Company proof" },
  { key: "panCard", label: "PAN card" },
  { key: "aadhaarCard", label: "Aadhaar card" },
  { key: "selfie", label: "Selfie" },
] as const;

/** Submitted verification documents (owner-only private files). */
export default function KycDocumentsPage() {
  const { loading, user } = useHydratedUser();
  const status = user?.kycStatus || "not_submitted";

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar backHref="/dashboard/profile" caption="VERIFICATION" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Display size="md" title="Your documents" />
        {status !== "not_submitted" && <Chip tone={CHIP[status].tone}>{CHIP[status].label}</Chip>}
      </div>
      {status === "not_submitted" && (
        <p className="text-[13px] text-sfx-muted">
          You haven’t submitted documents yet.{" "}
          <Link href="/kyc" className="font-semibold text-sfx-accent">
            Start verification
          </Link>
        </p>
      )}
      {loading ? (
        <Skeleton className="h-[320px]" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {DOCS.map((d) => {
            const ref = user?.kycDocuments?.[d.key];
            const pdf = ref?.toLowerCase().endsWith(".pdf");
            return (
              <section key={d.key} className="sfx-tile flex flex-col gap-3 p-4" aria-label={d.label}>
                <p className="text-[13px] font-medium text-sfx-text">{d.label}</p>
                {!ref ? (
                  <p className="text-[12px] text-sfx-muted">Not submitted</p>
                ) : pdf ? (
                  <OpenFileButton fileRef={ref} className="inline-flex items-center gap-2 text-[13px] font-semibold text-sfx-accent">
                    <FileText size={16} /> Open PDF
                  </OpenFileButton>
                ) : (
                  <SecureImage fileRef={ref} alt={d.label} className="h-44 w-full rounded-[10px] bg-sfx-surface-solid object-contain" />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
