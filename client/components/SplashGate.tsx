"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Medallion, Wordmark } from "@/components/sfx/Brand";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getNextRoute } from "@/services/session.service";

/** Entry route: signed-in users go to their next step, everyone else sees Welcome. */
export const SplashGate = () => {
  const router = useRouter();
  const { loading, user } = useHydratedUser();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? getNextRoute(user) : "/welcome");
  }, [loading, router, user]);

  return (
    <div className="sfx sfx-page flex flex-col items-center justify-center gap-6">
      <Medallion size={132} />
      <Wordmark size="lg" />
      <p className="text-[12px] tracking-[0.08em] text-sfx-muted">SECURING YOUR SESSION…</p>
    </div>
  );
};
