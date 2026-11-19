"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Medallion } from "@/components/sfx/Brand";
import { AppShell } from "@/components/sfx/AppShell";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getNextRoute } from "@/services/session.service";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, user } = useHydratedUser();
  // Local UI preview without a backend (development only).
  const isDevPreview = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_PREVIEW === "true";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (!isDevPreview) router.replace("/login");
      return;
    }
    const expected = getNextRoute(user);
    if (expected !== "/dashboard") router.replace(expected);
  }, [isDevPreview, loading, router, user]);

  const allowed = isDevPreview || (user && getNextRoute(user) === "/dashboard");

  if (loading || !allowed) {
    return (
      <div className="sfx sfx-page flex items-center justify-center">
        <Medallion size={96} />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
