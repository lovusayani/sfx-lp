import { ReactNode } from "react";

import { Medallion } from "./Brand";
import { cn } from "./cn";
import { Chip } from "./ui";

/** "Hero / Gold display" card from Figma (326×325, 30px radius, gold hairline). */
export function GoldHero({
  caption,
  step,
  totalSteps = 3,
  onStep,
  visual,
  className,
}: {
  caption: ReactNode;
  step?: number;
  totalSteps?: number;
  onStep?: (index: number) => void;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sfx-card flex min-h-[325px] flex-col items-center justify-center gap-[14px] px-5 pb-6 pt-4", className)}>
      <div className="flex w-full items-start justify-between">
        <Chip>
          <span className="h-1.5 w-1.5 rounded-full bg-sfx-gold" aria-hidden />
          LP PORTAL
        </Chip>
        <Chip>SECURE&nbsp;&nbsp;•&nbsp;&nbsp;256 BIT</Chip>
      </div>
      <div className="mt-3">{visual ?? <Medallion size={180} />}</div>
      <p className="text-center text-[14px] font-medium text-sfx-text">{caption}</p>
      {typeof step === "number" && (
        <div className="flex items-center gap-2" role="tablist" aria-label="Introduction steps">
          {Array.from({ length: totalSteps }, (_, i) => (
            <Chip
              key={i}
              as={onStep ? "button" : "span"}
              onClick={onStep ? () => onStep(i) : undefined}
              active={i === step}
              className={cn(i !== step && "opacity-60")}
            >
              {String(i + 1).padStart(2, "0")}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
