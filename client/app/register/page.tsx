"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { isStrongPassword } from "@/components/sfx/PasswordChecklist";
import { Alert, Button, ButtonLink, Checkbox, Chip, Display, Field, TopBar } from "@/components/sfx/ui";
import { FeatureUnavailableError, registerAccount } from "@/services/auth.service";

/** Figma: DARK / 06 Create account */
export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const confirmError = form.confirm && form.confirm !== form.password ? "Passwords do not match" : "";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!isStrongPassword(form.password)) {
      setError("Use at least 6 characters with a letter and a number.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!agree) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }
    setSubmitting(true);
    try {
      await registerAccount({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setDone(true);
    } catch (e) {
      if (e instanceof FeatureUnavailableError) setNotice(e.message);
      else setError(e instanceof Error ? e.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <TopBar backHref="/login" caption="NEW ACCOUNT" />
        <Display title="Check your inbox." subtitle="We sent a verification code to your email. Enter it to activate your account." />
        <ButtonLink href={`/verify?email=${encodeURIComponent(form.email)}&purpose=register`}>Enter code</ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <TopBar backHref="/login" caption="NEW ACCOUNT" />
      <Chip className="self-start">GET STARTED</Chip>
      <Display title="Create your LP account." subtitle="Start with a few details. Verification follows." />

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Full name" autoComplete="name" placeholder="Your legal name" value={form.fullName} onChange={set("fullName")} required />
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
        <Field label="Mobile number (optional)" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 ••••• •••••" value={form.phone} onChange={set("phone")} />
        <Field label="Password" type="password" autoComplete="new-password" placeholder="Create a strong password" value={form.password} onChange={set("password")} required />
        <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat password" value={form.confirm} onChange={set("confirm")} error={confirmError} required />
        <Checkbox checked={agree} onChange={setAgree}>
          I agree to the Terms and Privacy Policy
        </Checkbox>

        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        <Button type="submit" loading={submitting} className="mt-1">
          Create account
        </Button>
        <p className="text-[13px] text-sfx-muted">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-sfx-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
