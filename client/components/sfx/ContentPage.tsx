"use client";

import { ReactNode, useEffect, useState } from "react";

import { getPageContent, UserPageContent } from "@/services/user.service";

import { EmptyState, Skeleton } from "./ActivityList";
import { RichText } from "./kit";
import { Display, TopBar } from "./ui";

/** Admin-editable text page (Admin → Page setup): support, help, about. */
export function ContentPage({
  slug,
  fallbackTitle,
  caption,
  subtitle,
  footer,
}: {
  slug: string;
  fallbackTitle: string;
  caption: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  const [data, setData] = useState<UserPageContent | null | undefined>(undefined);

  useEffect(() => {
    getPageContent(slug).then(setData, () => setData(null));
  }, [slug]);

  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TopBar caption={caption} />
      <Display size="md" title={data?.title || fallbackTitle} subtitle={subtitle} />
      {data === undefined ? (
        <Skeleton className="h-[220px]" />
      ) : data?.content?.trim() ? (
        <article className="sfx-card max-w-[720px] p-[21px] md:p-8">
          <RichText text={data.content} />
        </article>
      ) : (
        <EmptyState title="Nothing here yet" body="This page hasn’t been written yet. Please check back soon." />
      )}
      {footer}
    </div>
  );
}
