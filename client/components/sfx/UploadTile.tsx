"use client";

import { useEffect, useId, useMemo } from "react";
import { Check, FileText, Plus } from "lucide-react";

import { cn } from "./cn";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const validateUpload = (file: File): string | null => {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) return "Use a JPG, PNG, WEBP or PDF file.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than 10 MB.";
  return null;
};

/** Dashed upload tile (Figma 2:330). Shows a thumbnail once a file is chosen. */
export function UploadTile({
  title,
  hint = "JPG, PNG or PDF • max 10 MB",
  file,
  onFile,
  onError,
  capture,
  accept = "image/*,application/pdf",
  className,
  tall,
}: {
  title: string;
  hint?: string;
  file?: File;
  onFile: (file: File) => void;
  onError?: (message: string) => void;
  capture?: "user" | "environment";
  accept?: string;
  className?: string;
  tall?: boolean;
}) {
  const id = useId();
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[22px] border border-dashed px-5 text-center transition",
        tall ? "min-h-[205px]" : "min-h-[132px]",
        file ? "border-sfx-border-strong bg-sfx-gold-soft/30" : "border-sfx-border bg-sfx-surface-2 hover:border-sfx-border-strong",
        className
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const problem = validateUpload(f);
          if (problem) onError?.(problem);
          else onFile(f);
        }}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      ) : null}
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
        {file ? <Check size={20} /> : file === undefined ? <Plus size={22} /> : <FileText size={20} />}
      </span>
      <span className="relative text-[14px] font-medium text-sfx-text">{file ? file.name : title}</span>
      <span className="relative text-[11px] text-sfx-muted">{file ? "Tap to replace" : hint}</span>
    </label>
  );
}
