import { ReactNode } from "react";

import { BrandFooter, Credit, Medallion, Wordmark } from "./Brand";
import { cn } from "./cn";

/**
 * Frame for welcome, onboarding, auth and KYC screens.
 * Phone: single 390-wide column exactly as in Figma (32px gutters).
 * Tablet: same column centred with more breathing room.
 * Desktop (lg+): split view — brand panel left, the screen's content right.
 */
export function AuthLayout({
  children,
  footer = true,
  className,
  aside,
}: {
  children: ReactNode;
  footer?: boolean;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="sfx sfx-page flex">
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden border-r border-sfx-line p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_30%_40%,rgba(245,211,79,0.12),transparent_70%)]"
        />
        <Wordmark size="lg" full className="relative" />
        <div className="relative flex flex-col items-start gap-8">
          {aside ?? (
            <>
              <Medallion size={240} />
              <div className="space-y-3">
                <h2 className="text-[40px] font-bold leading-[1.1] text-sfx-text">
                  Your capital.
                  <br />
                  One clear view.
                </h2>
                <p className="max-w-sm text-[15px] text-sfx-muted">
                  Manage your LP account, funds and trades with confidence.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="relative flex flex-col gap-1">
          <BrandFooter />
          <Credit className="text-left" />
        </div>
      </aside>

      <main className="flex min-h-[100dvh] flex-1 justify-center">
        <div
          className={cn(
            "sfx-enter flex w-full max-w-[460px] flex-col gap-3.5 px-5 pb-6 pt-6 md:pt-14 lg:justify-center lg:pt-10",
            className
          )}
        >
          {children}
          {footer && <BrandFooter className="mt-auto pt-2 lg:hidden" />}
          <Credit className={cn("lg:hidden", footer ? "" : "mt-auto pt-2")} />
        </div>
      </main>
    </div>
  );
}
