import { cn } from "./cn";

/** Rules shown in Figma 2:218. The API itself requires 8+ characters; the UI asks for stronger. */
export const PASSWORD_RULES = [
  { id: "length", label: "12+ characters", test: (v: string) => v.length >= 12 },
  { id: "mix", label: "Letter & number", test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
  { id: "special", label: "Special character", test: (v: string) => /[^a-z0-9]/i.test(v) },
] as const;

export const isStrongPassword = (value: string) => PASSWORD_RULES.every((r) => r.test(value));

export function PasswordChecklist({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn("sfx-tile flex flex-col gap-3 p-[21px]", className)} aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sfx-muted">Password checklist</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.id} className={cn("text-[12px] font-medium", ok ? "text-sfx-success" : "text-sfx-muted")}>
              {ok ? "✓" : "○"} {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
