import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import ForegroundPushListener from "@/components/push/ForegroundPushListener";
import { FrontendThemeController } from "@/components/theme/FrontendThemeController";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Swiss Liquidity", template: "%s · Swiss Liquidity" },
  description: "Your LP account, funds and trades in one secure place.",
  applicationName: "Swiss Liquidity",
  appleWebApp: { capable: true, title: "Swiss Liquidity", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/pwa-icon/64", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/pwa-icon/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c0a",
};

/**
 * Apply the right theme before paint to avoid a light/dark flash.
 * Admin panel: the admin's own choice. App: the theme the admin set for users,
 * or the user's own choice when the admin allows it (see FrontendThemeController).
 */
const themeBootScript = `try{var s=localStorage,t;if(location.pathname.indexOf('/admin')===0){t=s.getItem('sfx_admin_theme')||'dark'}else{var o=s.getItem('sfx_theme');t=(s.getItem('sfx_allow_user_theme')==='1'&&o)?o:(s.getItem('sfx_app_theme')||'dark')}if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <FrontendThemeController />
        <ForegroundPushListener />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
