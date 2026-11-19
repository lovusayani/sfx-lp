"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { OtpInput } from "@/components/sfx/OtpInput";
import { Alert, Button, Chip, Display, TopBar } from "@/components/sfx/ui";
import { FeatureUnavailableError, resendOtpCode, verifyOtpCode } from "@/services/auth.service";

const CODE_TTL_SECONDS = 180;

/** Figma: DARK / 09 Verify OTP */
function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const purpose = params.get("purpose") || "login";

  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(CODE_TTL_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all six digits.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await verifyOtpCode(email, code, purpose);
      router.replace(purpose === "register" ? "/login" : "/");
    } catch (e) {
      if (e instanceof FeatureUnavailableError) setNotice(e.message);
      else setError(e instanceof Error ? e.message : "That code didn't work.");
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    try {
      await resendOtpCode(email, purpose);
      setRemaining(CODE_TTL_SECONDS);
      setNotice("A new code is on its way.");
    } catch (e) {
      if (e instanceof FeatureUnavailableError) setNotice(e.message);
      else setError(e instanceof Error ? e.message : "Could not resend the code.");
    }
  };

  return (
    <AuthLayout>
      <TopBar caption="VERIFY YOUR IDENTITY" />
      <div className="h-3" />
      <Chip className="self-start">ONE TIME CODE</Chip>
      <Display
        title="One final security check."
        subtitle={email ? `Enter the six-digit code sent to ${email}.` : "Enter the six-digit code sent to your registered email."}
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-[19px]">
        <OtpInput value={code} onChange={setCode} disabled={submitting} />
        <p className="text-[13px] text-sfx-muted">
          {remaining > 0 ? (
            <>
              Code expires in <span className="font-semibold text-sfx-text">{mmss}</span>
            </>
          ) : (
            "Code expired."
          )}
        </p>
        <p className="text-[13px] text-sfx-muted">
          Didn&rsquo;t get it?{" "}
          <button type="button" onClick={resend} className="font-semibold text-sfx-accent hover:underline">
            Resend code
          </button>
        </p>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        <Button type="submit" loading={submitting} disabled={code.length !== 6} className="mt-2">
          Verify &amp; continue
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
