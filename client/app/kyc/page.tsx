"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanFace, ShieldCheck } from "lucide-react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { cn } from "@/components/sfx/cn";
import { UploadTile } from "@/components/sfx/UploadTile";
import { Alert, Button, Chip, Display, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { clearKycSkipped, getNextRoute, markKycSkipped } from "@/services/session.service";
import { submitKycDocuments } from "@/services/user.service";

type DocKey = "companyProof" | "panCard" | "aadhaarCard";
type KycFiles = Partial<Record<DocKey | "selfie", File>>;

/** The API requires these three documents plus a selfie (business rules unchanged). */
const DOCUMENTS: Array<{ key: DocKey; title: string; hint: string }> = [
  { key: "companyProof", title: "Upload company proof", hint: "Registration or incorporation • max 10 MB" },
  { key: "panCard", title: "Upload PAN card", hint: "Front side, all corners visible" },
  { key: "aadhaarCard", title: "Upload Aadhaar card", hint: "Clear photo or PDF • max 10 MB" },
];

/**
 * Figma: DARK / 11 KYC introduction, 12 KYC document upload, 13 KYC review + selfie
 * (and LIGHT / 17 KYC). One route, three steps, one submission at the end.
 */
export default function KycPage() {
  const router = useRouter();
  const { loading, user } = useHydratedUser();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [files, setFiles] = useState<KycFiles>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.mustChangePassword || !user.onboardingCompleted || user.kycSubmitted) router.replace(getNextRoute(user));
  }, [loading, router, user]);

  const docsReady = DOCUMENTS.every((d) => files[d.key]);
  const pick = (key: keyof KycFiles) => (file: File) => {
    setError("");
    setFiles((f) => ({ ...f, [key]: file }));
  };

  const back = () => (step === 0 ? router.push("/dashboard") : setStep((s) => (s - 1) as 0 | 1));

  const skip = () => {
    markKycSkipped();
    router.replace("/dashboard");
  };

  const submit = async () => {
    if (!docsReady || !files.selfie) {
      setError("Please add all documents and a selfie.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitKycDocuments({
        companyProof: files.companyProof!,
        panCard: files.panCard!,
        aadhaarCard: files.aadhaarCard!,
        selfie: files.selfie,
      });
      clearKycSkipped();
      router.replace("/kyc/status");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (step === 0) {
    return (
      <AuthLayout key="intro">
        <TopBar onBack={back} back={false} caption="IDENTITY VERIFICATION" />
        <Chip className="self-start">STEP 01 OF 03</Chip>
        <div className="sfx-card flex min-h-[256px] flex-col items-center justify-center gap-4 px-4 text-center">
          <ShieldCheck size={84} strokeWidth={1.2} className="text-sfx-accent" />
          <p className="text-[13px] font-semibold tracking-[0.1em] text-sfx-accent">VERIFY YOUR IDENTITY</p>
          <p className="text-[14px] text-sfx-text">A secure step towards full account access.</p>
        </div>
        <Display title="Verify once. Move forward." subtitle="Complete identity checks to enable deposits, withdrawals and all eligible account features." />
        <div className="flex flex-wrap gap-2">
          <Chip>Company proof</Chip>
          <Chip>PAN</Chip>
          <Chip>Aadhaar</Chip>
          <Chip>Selfie</Chip>
        </div>
        <p className="text-[12px] text-sfx-muted">Your documents are handled securely.</p>
        <Button onClick={() => setStep(1)}>Begin verification</Button>
        <button type="button" onClick={skip} className="self-start text-[13px] font-medium text-sfx-muted hover:text-sfx-text">
          Skip for now
        </button>
      </AuthLayout>
    );
  }

  if (step === 1) {
    return (
      <AuthLayout key="docs">
        <TopBar onBack={back} caption="KYC / STEP 02 OF 03" />
        <Chip className="self-start">IDENTITY DETAILS</Chip>
        <Display title="Proof of identity." subtitle="Upload clear, valid documents. Make sure all corners are visible and text is readable." />
        <div className="grid gap-3.5 sm:grid-cols-2">
          {DOCUMENTS.map((d, i) => (
            <UploadTile
              key={d.key}
              title={d.title}
              hint={d.hint}
              file={files[d.key]}
              onFile={pick(d.key)}
              onError={setError}
              className={cn(i === 0 && "sm:col-span-2")}
            />
          ))}
        </div>
        {error && <Alert>{error}</Alert>}
        <Button onClick={() => (docsReady ? setStep(2) : setError("Please add all three documents."))}>Continue</Button>
      </AuthLayout>
    );
  }

  const summary: Array<[string, boolean]> = [
    ["Company proof", Boolean(files.companyProof)],
    ["PAN card", Boolean(files.panCard)],
    ["Aadhaar card", Boolean(files.aadhaarCard)],
    ["Selfie", Boolean(files.selfie)],
  ];

  return (
    <AuthLayout key="selfie">
      <TopBar onBack={back} caption="KYC / STEP 03 OF 03" />
      <Chip className="self-start">FINAL CHECK</Chip>
      <Display title="Almost verified." subtitle="Upload a clear selfie and confirm your information." />
      <UploadTile
        tall
        title="Take or upload selfie"
        hint="Face camera directly • no filters"
        accept="image/*"
        capture="user"
        file={files.selfie}
        onFile={pick("selfie")}
        onError={setError}
      />
      <div className="sfx-tile flex flex-col gap-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">Submission summary</p>
        {summary.map(([label, ok]) => (
          <p key={label} className="flex items-center justify-between text-[14px] text-sfx-text">
            {label}
            <span className={cn("text-[12px] font-semibold", ok ? "text-sfx-success" : "text-sfx-muted")}>
              {ok ? "✓ Added" : "Pending"}
            </span>
          </p>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      <Button onClick={submit} loading={submitting} disabled={!files.selfie}>
        <ScanFace size={18} /> Submit for verification
      </Button>
    </AuthLayout>
  );
}
