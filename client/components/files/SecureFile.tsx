"use client";

import { useEffect, useState } from "react";

import { fetchPrivateFileUrl, isPrivateRef, openFile, publicFileUrl } from "@/services/files.service";

/** Resolves a stored file reference (private or legacy public) to a displayable URL. */
export const useFileUrl = (ref?: string | null): string => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!ref) return;
    if (!isPrivateRef(ref)) {
      const t = setTimeout(() => setUrl(publicFileUrl(ref)), 0);
      return () => clearTimeout(t);
    }
    let created = "";
    let alive = true;
    fetchPrivateFileUrl(ref).then(
      (u) => {
        created = u;
        if (alive) setUrl(u);
      },
      () => undefined
    );
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [ref]);
  return ref ? url : "";
};

export function SecureImage({ fileRef, alt, className }: { fileRef?: string | null; alt: string; className?: string }) {
  const url = useFileUrl(fileRef);
  if (!url) return <div className={className} aria-label={`${alt} loading`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}

export function OpenFileButton({ fileRef, className, children }: { fileRef: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openFile(fileRef)}>
      {children}
    </button>
  );
}
