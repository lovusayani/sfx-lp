"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { isStrongPassword, PasswordChecklist } from "@/components/sfx/PasswordChecklist";
import { Alert, Button, Chip, Display, Field, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { changeUserPassword, FeatureUnavailableError, resetPasswordWithToken } from "@/services/auth.service";
import { getNextRoute } from "@/services/session.service";

/**
 * Figma: DARK / 08 Reset password.
 * Two entry points, same screen:
 *  - First sign-in (mustChangePassword): needs the temporary password from the admin.
 *  - Email reset link (?token=…): sets a new password without signing in.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { loading, user } = useHydratedUser();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token || loading) return;
    if (!user) router.replace("/login");
    else if (!user.mustChangePassword) router.replace(getNextRoute(user));
  }, [loading, router, token, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!isStrongPassword(next)) {
      setError("Your new password doesn't meet the checklist yet.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        await resetPasswordWithToken(token, next);
        setSuccess("Password updated. You can now sign in.");
        setTimeout(() => router.replace("/login"), 900);
      } else {
        await changeUserPassword(current, next);
        setSuccess("Password updated. Taking you onward…");
        setTimeout(() => router.replace("/onboarding"), 700);
      }
    } catch (e) {
      if (e instanceof FeatureUnavailableError) setNotice(e.message);
      else setError(e instanceof Error ? e.message : "Could not update password.");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <TopBar backHref="/login" caption="RESET PASSWORD" />
      <div className="h-3" />
      <Chip className="self-start">NEW CREDENTIALS</Chip>
      <Display
        title="Set a new password."
        subtitle={
          token
            ? "Choose a strong password you have not used before."
            : "For your security, replace the temporary password you were given."
        }
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {!token && (
          <Field
            label="Temporary password"
            type="password"
            autoComplete="current-password"
            placeholder="From your welcome email"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            minLength={1}
            required
          />
        )}
        <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={next} onChange={(e) => setNext(e.target.value)} required />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && confirm !== next ? "Passwords do not match" : ""}
          required
        />
        <PasswordChecklist value={next} />

        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <Button type="submit" loading={submitting} className="mt-1">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
