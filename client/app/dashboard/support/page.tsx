"use client";

import { BookOpen, CircleHelp } from "lucide-react";

import { ContentPage } from "@/components/sfx/ContentPage";
import { MenuList, MenuRow } from "@/components/sfx/kit";
import { SupportRequests } from "@/components/sfx/SupportRequests";

export default function SupportPage() {
  return (
    <ContentPage
      slug="support"
      fallbackTitle="Support"
      caption="SUPPORT"
      subtitle="We’re here to help with your account, deposits, withdrawals and trading."
      footer={
        <>
          <SupportRequests />
          <MenuList className="max-w-[720px]">
            <MenuRow href="/dashboard/faq" icon={CircleHelp} label="Frequently asked questions" />
            <MenuRow href="/dashboard/help" icon={BookOpen} label="Help guides" />
          </MenuList>
        </>
      }
    />
  );
}
