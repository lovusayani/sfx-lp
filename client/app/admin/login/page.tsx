"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Diamond, Lock } from "lucide-react";

import { useBranding } from "@/components/sfx/useBranding";
import { Alert, Button, Field } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { loginUser } from "@/services/auth.service";
import { clearSession } from "@/services/session.service";

/** Admin sign-in (separate from the client app). */
export default function AdminLoginPage() {
  const router = useRouter();
  const { appName, shortName } = useBranding();
  const { loading, user } = useHydratedUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(user.role === "admin" ? "/admin" : "/dashboard");
  }, [loading, router, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await loginUser(email, password);
      if (u.role !== "admin") {
        clearSession();
        throw new Error("This sign-in is for administrators only.");
      }
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sfx sfx-page flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="sfx-enter w-full max-w-[420px] rounded-[28px] border border-sfx-border bg-sfx-surface-2/50 p-7 md:p-9">
        <div className="mb-8 flex items-center gap-3">
          <Diamond size={28} className="text-sfx-gold" strokeWidth={2.2} />
          <span className="text-[15px] font-bold tracking-[0.04em] text-sfx-text">
            {shortName.toUpperCase()} <span className="text-sfx-muted">/</span> ADMIN
          </span>
        </div>
        <h1 className="text-[28px] font-bold text-sfx-text">Command center</h1>
        <p className="mt-1 text-[13px] text-sfx-muted">{appName} • Administrator sign-in</p>

        <div className="mt-7 flex flex-col gap-4">
          <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="mt-2">
            Sign in
          </Button>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-sfx-muted">
          <Lock size={12} /> Secure console • access is logged
        </p>
      </form>
    </div>
  );
}
