"use client";

import { ClipboardEvent, KeyboardEvent, useRef } from "react";

import { cn } from "./cn";

/** Six 44×58 boxes (Figma 2:237). Supports paste, backspace and arrow keys; SMS/email autofill via one-time-code. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setAt = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    onChange(arr.join("").slice(0, length));
  };

  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i]) {
      e.preventDefault();
      setAt(i - 1, "");
      focus(i - 1);
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={length}
          onPaste={onPaste}
          onKeyDown={onKey(i)}
          onChange={(e) => {
            const only = e.target.value.replace(/\D/g, "");
            if (only.length > 1) {
              onChange((digits.slice(0, i).join("") + only).slice(0, length));
              focus(i + only.length);
              return;
            }
            setAt(i, only);
            if (only) focus(i + 1);
          }}
          className={cn(
            "h-[58px] w-[44px] rounded-[14px] border bg-sfx-field text-center text-[24px] font-semibold text-sfx-text focus:border-sfx-gold focus:outline-none sm:w-[50px]",
            d ? "border-sfx-border-strong" : "border-sfx-line"
          )}
        />
      ))}
    </div>
  );
}
