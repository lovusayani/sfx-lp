"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { BrandName } from "@/components/sfx/Brand";
import { Alert, Button, ButtonLink, Checkbox, Display, Field, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { CodeRequiredError, loginUser, verifyRoute } from "@/services/auth.service";
import { enablePushNotifications, hasFirebasePushConfig } from "@/services/push-notifications.service";
import { getNextRoute, getRememberDevice, setRememberDevice } from "@/services/session.service";

const CAMERA_PERMISSION_CHECK_KEY = "sfx_camera_permission_checked";

/** Ask once for camera access so the KYC selfie step works smoothly. Never blocks sign-in. */
const requestCameraPermission = async (): Promise<void> => {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  const nav = navigator as Navigator & {
    permissions?: { query: (d: PermissionDescriptor) => Promise<{ state: PermissionState }> };
  };
  if (nav.permissions?.query) {
    try {
      const status = await nav.permissions.query({ name: "camera" as PermissionName });
      if (status.state !== "prompt") return;
    } catch {
      // Permissions API may not support "camera"; fall through to the local marker.
    }
  } else if (window.localStorage.getItem(CAMERA_PERMISSION_CHECK_KEY) === "true") {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // Denied or unavailable — not a sign-in problem.
  } finally {
    window.localStorage.setItem(CAMERA_PERMISSION_CHECK_KEY, "true");
  }
};

const requestPushPermission = async (enabled: boolean): Promise<void> => {
  if (typeof window === "undefined" || !enabled || !hasFirebasePushConfig()) return;
  try {
    await enablePushNotifications();
  } catch {
    // Unsupported browser or denied permission should not block sign-in.
  }
};

/** Figma: DARK / 05 Sign in, LIGHT / 16 Sign in */
export default function LoginPage() {
  const router = useRouter();
  const { loading, user } = useHydratedUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => getRememberDevice());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(getNextRoute(user));
  }, [loading, router, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      setRememberDevice(remember);
      const signedIn = await loginUser(email.trim(), password);
      await Promise.allSettled([requestPushPermission(Boolean(signedIn.settings?.alerts)), requestCameraPermission()]);
      router.replace(getNextRoute(signedIn));
    } catch (e) {
      if (e instanceof CodeRequiredError) return router.push(verifyRoute(e));
      setError(e instanceof Error ? e.message : "Sign in failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <TopBar backHref="/welcome" caption="WELCOME BACK" />
      <div className="h-3" />
      <BrandName className="text-[20px] font-bold tracking-wide text-sfx-accent" />
      <Display title="Sign in to your account." subtitle="Your funds and account, right where you left them." />

      <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-[19px]" noValidate={false}>
        <Field
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <div className="flex items-center justify-between">
          <Checkbox checked={remember} onChange={setRemember}>
            Remember this device
          </Checkbox>
          <Link href="/forgot-password" className="text-[12px] font-medium text-sfx-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" loading={submitting} className="mt-2">
          Sign in
        </Button>
        <ButtonLink href="/register" variant="secondary">
          Create an account
        </ButtonLink>
      </form>
    </AuthLayout>
  );
}
