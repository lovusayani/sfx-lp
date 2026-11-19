"use client";

import { ReactNode } from "react";

import { PageHeader, SubTabs } from "@/components/admin/ui";

/** Figma: ADMIN / Trading. One section, four tabs. */
export default function AdminTradingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Trading" />
      <SubTabs
        tabs={[
          { href: "/admin/trading", label: "Order report" },
          { href: "/admin/trading/results", label: "Trade results" },
          { href: "/admin/trading/charges", label: "Charges" },
          { href: "/admin/trading/sources", label: "API sources" },
        ]}
      />
      {children}
    </>
  );
}
