"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthLayout } from "@/components/sfx/AuthLayout";
import { Wordmark } from "@/components/sfx/Brand";
import { GoldHero } from "@/components/sfx/Hero";
import { ButtonLink, Display } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getNextRoute } from "@/services/session.service";

/** Figma: DARK / 01 Welcome */
export default function WelcomePage() {
  const router = useRouter();
  const { loading, user } = useHydratedUser();

  useEffect(() => {
    if (!loading && user) router.replace(getNextRoute(user));
  }, [loading, router, user]);

  return (
    <AuthLayout>
      <Wordmark className="lg:hidden" />
      <div className="h-6 lg:hidden" />
      <GoldHero caption="Private wealth. Clear control." step={0} onStep={(i) => router.push(`/onboarding?step=${i}`)} />
      <div className="h-2" />
      <Display
        title={
          <>
            Your capital.
            <br />
            One clear view.
          </>
        }
        subtitle="Manage your LP account, funds and trades with confidence."
      />
      <div className="mt-1 flex flex-col gap-3.5">
        <ButtonLink href="/onboarding">Get started</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          I have an account
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
