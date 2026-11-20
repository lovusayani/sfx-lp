"use client";

import { useId } from "react";

import { cn } from "./cn";
import { useBranding } from "./useBranding";

/**
 * Uploaded logo (Admin → Settings → Logos). Both theme versions are rendered and CSS shows the one
 * that matches <html class="dark|light">, so there is no flash when the theme changes.
 * `compact` prefers the small/mobile logo. Returns null when no logo is uploaded.
 */
export function BrandLogo({ className, height = 32, compact }: { className?: string; height?: number; compact?: boolean }) {
  const { appName, darkLogo, lightLogo, mobileLogo } = useBranding();
  const onDark = (compact && mobileLogo) || darkLogo || lightLogo || mobileLogo;
  const onLight = (compact && mobileLogo) || lightLogo || darkLogo || mobileLogo;
  if (!onDark) return null;
  const style = { height, width: "auto", maxWidth: "100%" } as const;
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={appName} role="img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={onDark} alt="" style={style} className="sfx-logo-on-dark object-contain" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={onLight} alt="" style={style} className="sfx-logo-on-light object-contain" draggable={false} />
    </span>
  );
}

/**
 * Wordmark (Figma 2:3): the uploaded logo when there is one; otherwise the short name in gold
 * with a small muted "LP". `full` shows the full product name instead, for roomy layouts.
 */
export function Wordmark({ className, size = "md", full }: { className?: string; size?: "md" | "lg"; full?: boolean }) {
  const { appName, shortName, darkLogo, lightLogo } = useBranding();
  if (darkLogo || lightLogo) return <BrandLogo className={className} height={size === "lg" ? 44 : 32} />;
  return (
    <span className={cn("inline-flex items-start gap-2 leading-none", className)} aria-label={appName}>
      <span className={cn("font-bold tracking-tight text-sfx-accent", size === "lg" ? "text-[26px]" : "text-[21px]")}>
        {full ? appName : shortName}
      </span>
      <span className="text-[11px] font-semibold text-sfx-muted">LP</span>
    </span>
  );
}

/** Developer credit shown as a quiet watermark at the bottom of the app and admin. */
export function Credit({ className }: { className?: string }) {
  return (
    <p className={cn("select-none text-center text-[10px] tracking-wide text-sfx-muted/60", className)}>
      Developed by{" "}
      <a
        href="https://srstechacademy.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-sfx-muted/80 transition hover:text-sfx-accent"
      >
        SPRS Infotech
      </a>
    </p>
  );
}

/** Plain product name for headings and copy. */
export function BrandName({ className }: { className?: string }) {
  const { appName } = useBranding();
  return <span className={className}>{appName}</span>;
}

/** Footer caption used on auth screens (Figma 2:32). */
export function BrandFooter({ className }: { className?: string }) {
  const { appName } = useBranding();
  return (
    <p className={cn("text-[10px] font-medium uppercase tracking-wide text-sfx-muted", className)}>
      {appName}&nbsp;&nbsp;/&nbsp;&nbsp;PRIVATE &amp; SECURE
    </p>
  );
}

/**
 * Gold 3D medallion (Figma "Gold 3D medallion"), rebranded with an S monogram.
 * Pure SVG so it stays crisp at any size and works offline in the PWA.
 */
export function Medallion({ size = 180, className, animated = true }: { size?: number; className?: string; animated?: boolean }) {
  // Unique gradient ids per instance: a hidden duplicate (e.g. desktop panel) must not break the visible one.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      className={className}
      role="img"
      aria-label="Medallion"
    >
      <defs>
        <radialGradient id={id("sfxHalo")} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#1a1a12" />
          <stop offset="100%" stopColor="#0b0c0a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("sfxGold")} x1="20%" y1="10%" x2="80%" y2="95%">
          <stop offset="0%" stopColor="#fff1a8" />
          <stop offset="38%" stopColor="#f5d34f" />
          <stop offset="72%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6a12" />
        </linearGradient>
        <linearGradient id={id("sfxGoldInner")} x1="80%" y1="10%" x2="20%" y2="95%">
          <stop offset="0%" stopColor="#e9c13b" />
          <stop offset="100%" stopColor="#a8811a" />
        </linearGradient>
        <radialGradient id={id("sfxFace")} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#24221a" />
          <stop offset="100%" stopColor="#11120d" />
        </radialGradient>
      </defs>
      <circle cx="90" cy="90" r="88" fill={`url(#${id("sfxHalo")})`} />
      <g className={animated ? "sfx-orbit" : undefined}>
        <circle cx="90" cy="90" r="76" fill="none" stroke="#f5d34f" strokeOpacity="0.45" strokeWidth="1" />
        <circle cx="90" cy="90" r="70" fill="none" stroke="#f5d34f" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 7" />
        <circle cx="21" cy="62" r="4.5" fill="#f5d34f" />
        <circle cx="158" cy="118" r="5.5" fill="#f5d34f" />
      </g>
      <circle cx="90" cy="90" r="58" fill={`url(#${id("sfxGold")})`} />
      <circle cx="90" cy="90" r="50" fill={`url(#${id("sfxGoldInner")})`} />
      <circle cx="90" cy="90" r="44" fill={`url(#${id("sfxFace")})`} />
      <path
        d="M90 56 L119.4 73 L119.4 107 L90 124 L60.6 107 L60.6 73 Z"
        fill="none"
        stroke={`url(#${id("sfxGold")})`}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <text
        x="90"
        y="104"
        textAnchor="middle"
        fontFamily="var(--font-inter), system-ui, sans-serif"
        fontSize="42"
        fontWeight="700"
        fill={`url(#${id("sfxGold")})`}
      >
        S
      </text>
      <ellipse cx="70" cy="52" rx="22" ry="7" fill="#ffffff" opacity="0.18" transform="rotate(-28 70 52)" />
    </svg>
  );
}
