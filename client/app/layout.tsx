import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import ForegroundPushListener from "@/components/push/ForegroundPushListener";
import { FrontendThemeController } from "@/components/theme/FrontendThemeController";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Admin panel keeps its current typography until its redesign.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Swiss Liquidity", template: "%s · Swiss Liquidity" },
  description: "Your LP account, funds and trades in one secure place.",
  applicationName: "Swiss Liquidity",
  appleWebApp: { capable: true, title: "Swiss Liquidity", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c0a",
};

// Apply the stored theme before paint to avoid a light/dark flash.
const themeBootScript = `try{if(!location.pathname.startsWith('/admin')){var t=localStorage.getItem('sfx_theme')||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.classList.add(t)}}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <FrontendThemeController />
        <ForegroundPushListener />
        {children}
      </body>
    </html>
  );
}
