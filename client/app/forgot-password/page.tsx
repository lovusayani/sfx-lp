"use client";

import { FormEvent, useState } from "react";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { Alert, Button, ButtonLink, Chip, Display, Field, TopBar } from "@/components/sfx/ui";
import { FeatureUnavailableError, requestPasswordReset } from "@/services/auth.service";

/** Figma: DARK / 07 Password recovery */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      if (e instanceof FeatureUnavailableError) setNotice(e.message);
      else setError(e instanceof Error ? e.message : "Could not send the reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <TopBar backHref="/login" caption="ACCOUNT RECOVERY" />
      <div className="h-4" />
      <Chip className="self-start">RECOVER ACCESS</Chip>
      <Display title="Forgot your password?" subtitle="Enter your registered email and we will send a secure reset link." />

      <form onSubmit={onSubmit} className="flex flex-col gap-[19px]">
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <div className="sfx-tile flex flex-col gap-2 p-[21px]">
          <p className="text-[14px] font-semibold text-sfx-accent">✦ Security reminder</p>
          <p className="text-[12px] leading-relaxed text-sfx-muted">
            We will never ask you to share your password or verification code.
          </p>
        </div>

        {sent && <Alert tone="success">If that email is registered, a reset link is on its way. Check your inbox.</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}

        <Button type="submit" loading={submitting} className="mt-1">
          Send reset link
        </Button>
        <ButtonLink href="/login" variant="secondary">
          Back to sign in
        </ButtonLink>
      </form>
    </AuthLayout>
  );
}
