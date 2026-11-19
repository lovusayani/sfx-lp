"use client";

import { FormEvent, useEffect, useState } from "react";

import { DEFAULT_BRANDING } from "@/components/sfx/useBranding";
import { getBrandingAssets, updateBrandingName } from "@/services/branding.service";

/** Admin → Setup: product name shown across the user app (full name + short wordmark). */
export function BrandNameForm() {
  const [appName, setAppName] = useState(DEFAULT_BRANDING.appName);
  const [shortName, setShortName] = useState(DEFAULT_BRANDING.shortName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getBrandingAssets()
      .then((b) => {
        if (b.appName) setAppName(b.appName);
        if (b.shortName) setShortName(b.shortName);
      })
      .catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateBrandingName(appName.trim(), shortName.trim());
      try {
        localStorage.removeItem("sfx_branding");
      } catch {
        // ignore
      }
      setMessage("Saved. Users see the new name on their next visit.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-sm">
      <h2 className="text-lg font-semibold">Product name</h2>
      <p className="mt-1 text-sm text-zinc-400">Shown to users in the app, page titles and footers.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-300">Full name</span>
          <input className="input" value={appName} maxLength={60} onChange={(e) => setAppName(e.target.value)} required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-300">Short name (logo text)</span>
          <input className="input" value={shortName} maxLength={12} onChange={(e) => setShortName(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save name"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-zinc-300">{message}</p>}
    </form>
  );
}
