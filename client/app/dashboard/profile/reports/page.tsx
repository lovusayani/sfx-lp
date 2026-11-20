"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";

import { EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { formatDate } from "@/components/sfx/format";
import { Alert, Display, Spinner, TopBar } from "@/components/sfx/ui";
import { downloadPnlFile, getUserPnlUploads, UserPnlUploadRecord } from "@/services/user.service";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

/** Statements and P&L reports shared by the desk (PDF). */
export default function ReportsPage() {
  const [reports, setReports] = useState<UserPnlUploadRecord[] | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    setReports(null);
    setError("");
    getUserPnlUploads().then(setReports, () => {
      setReports([]);
      setError("We couldn't load your reports. Please try again.");
    });
  }, []);

  useEffect(load, [load]);

  const download = async (r: UserPnlUploadRecord) => {
    if (downloading) return;
    setDownloading(r.id);
    setError("");
    try {
      await downloadPnlFile(r.id, r.originalName);
    } catch {
      setError(`Couldn't download “${r.originalName}”. Please try again.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar
        backHref="/dashboard/profile"
        right={
          <button
            type="button"
            onClick={load}
            aria-label="Refresh reports"
            className="flex h-9 w-9 items-center justify-center rounded-full text-sfx-muted hover:bg-sfx-gold-soft/40 hover:text-sfx-text"
          >
            <RefreshCw size={16} />
          </button>
        }
      />
      <Display size="md" title="Reports & statements" subtitle="Account statements and P&L reports shared with you. Tap one to download." />
      {error && <Alert>{error}</Alert>}
      {reports === null ? (
        <Skeleton className="h-[220px]" />
      ) : reports.length === 0 ? (
        <EmptyState title="No reports yet" body="When the desk shares a statement with you, it will appear here." />
      ) : (
        <ul className="sfx-card divide-y divide-sfx-line px-4 py-1">
          {reports.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => download(r)}
                disabled={Boolean(downloading)}
                className="flex w-full items-center gap-3 py-3.5 text-left disabled:cursor-wait"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-sfx-gold-soft text-sfx-accent">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-sfx-text">{r.originalName}</span>
                  <span className="block text-[11px] text-sfx-muted">
                    {formatDate(r.uploadedAt)} · {formatBytes(r.fileSize)}
                  </span>
                </span>
                {downloading === r.id ? <Spinner className="text-sfx-accent" /> : <Download size={17} className="text-sfx-muted" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
