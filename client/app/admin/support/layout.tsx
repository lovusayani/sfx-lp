"use client";

import { ReactNode } from "react";

import { PageHeader, SubTabs } from "@/components/admin/ui";

/** Support: client requests (tickets) and the help pages shown in the app. */
export default function AdminSupportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Support" />
      <SubTabs
        tabs={[
          { href: "/admin/support", label: "Tickets" },
          { href: "/admin/support/content", label: "Help content" },
        ]}
      />
      {children}
    </>
  );
}
