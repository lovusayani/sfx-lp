"use client";

import { LicenseSectionLock } from "@/components/license/LicenseGate";
import { useEffect, useState } from "react";
import { Download, ImageUp, Monitor, Moon, Sun, Trash2 } from "lucide-react";

import { Btn, Dialog, FilterChips, Loading, PageHeader, Panel } from "@/components/admin/ui";
import { Alert, Checkbox, Field } from "@/components/sfx/ui";
import { cn } from "@/components/sfx/cn";
import { Toggle } from "@/components/sfx/kit";
import { applyBrandingAssets, AppTheme, DEFAULT_BRANDING } from "@/components/sfx/useBranding";
import { deleteAdminPaymentQr, getAdminPaymentSetup, PaymentSetupConfig, updateAdminPaymentSetup, uploadAdminPaymentQr } from "@/services/admin.service";
import { getPublicAssetUrl } from "@/services/api";
import {
  BrandingAssets,
  BrandingLogoVariant,
  getBrandingAssets,
  updateAppTheme,
  updateBrandingName,
  uploadAdminBrandingLogo,
} from "@/services/branding.service";
import { DataTableInfo, exportDataTables, getDataTables, resetDataTables } from "@/services/dataManagement.service";

type Section = "branding" | "appearance" | "payments" | "data";
type Msg = { tone: "success" | "danger"; text: string } | null;
const NETWORKS = ["TRC20", "ERC20", "BEP20"] as const;
const errText = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

/** Settings: branding, deposit wallets, data export/reset. */
export default function AdminSettingsPage() {
  const [section, setSection] = useState<Section>("branding");
  return (
    <>
      <PageHeader title="Settings" />
      <FilterChips
        value={section}
        onChange={setSection}
        label="Settings section"
        options={[
          { value: "branding", label: "Branding" },
          { value: "appearance", label: "Appearance" },
          { value: "payments", label: "Deposit wallets" },
          { value: "data", label: "Data" },
        ]}
      />
      <div className="mt-4">
        {section === "branding" && <BrandingSection />}
        {section === "appearance" && <AppearanceSection />}
        {section === "payments" && (
          <>
            <LicenseSectionLock onLeave={() => setSection("branding")} leaveLabel="Back to settings" />
            <PaymentsSection />
          </>
        )}
        {section === "data" && <DataSection />}
      </div>
    </>
  );
}

/* ── Branding ─────────────────────────────────────────────────────── */

const LOGOS: Array<{ variant: BrandingLogoVariant; key: keyof BrandingAssets; label: string; hint: string; bg: string }> = [
  { variant: "dark", key: "darkLogoPath", label: "Logo on dark", hint: "Light-coloured logo for the dark theme · about 540 × 148 px", bg: "bg-[#0b0c0a]" },
  { variant: "light", key: "lightLogoPath", label: "Logo on light", hint: "Dark-coloured logo for the light theme · about 540 × 148 px", bg: "bg-[#f4f1e8]" },
  { variant: "mobile", key: "mobileLogoPath", label: "Small logo", hint: "Used where space is tight (collapsed admin menu) · about 360 × 124 px", bg: "bg-[#1a1b17]" },
];

function BrandingSection() {
  const [assets, setAssets] = useState<BrandingAssets | null>(null);
  const [appName, setAppName] = useState("");
  const [shortName, setShortName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let alive = true;
    getBrandingAssets().then(
      (b) => {
        if (!alive) return;
        setAssets(b);
        setAppName(b.appName || DEFAULT_BRANDING.appName);
        setShortName(b.shortName || DEFAULT_BRANDING.shortName);
      },
      (e) => alive && (setAssets({ darkLogoPath: "", lightLogoPath: "", mobileLogoPath: "" }), setMsg({ tone: "danger", text: errText(e, "Couldn’t load branding.") }))
    );
    return () => {
      alive = false;
    };
  }, []);

  const clearCache = () => {
    try {
      localStorage.removeItem("sfx_branding");
    } catch {
      // storage unavailable
    }
  };

  const saveName = async () => {
    if (!appName.trim()) return setMsg({ tone: "danger", text: "Enter the product name." });
    setBusy("name");
    setMsg(null);
    try {
      const saved = await updateBrandingName(appName.trim(), shortName.trim());
      setAssets(saved);
      clearCache();
      applyBrandingAssets(saved);
      setMsg({ tone: "success", text: "Name saved. Clients see it on their next visit." });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t save the name.") });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (variant: BrandingLogoVariant, file?: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") return setMsg({ tone: "danger", text: "Choose a PNG file (a transparent background works best)." });
    setBusy(variant);
    setMsg(null);
    try {
      const saved = await uploadAdminBrandingLogo(variant, file);
      setAssets(saved);
      clearCache();
      applyBrandingAssets(saved);
      setMsg({ tone: "success", text: "Logo updated." });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Upload failed.") });
    } finally {
      setBusy(null);
    }
  };

  if (!assets) return <Loading rows={3} />;

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Panel title="Product name" aside="Shown across the client app">
        <form
          className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <Field label="Full name" value={appName} maxLength={60} onChange={(e) => setAppName(e.target.value)} />
          <Field label="Short name (wordmark)" value={shortName} maxLength={12} onChange={(e) => setShortName(e.target.value)} />
          <Btn type="submit" loading={busy === "name"} className="h-[46px]">
            Save name
          </Btn>
        </form>
      </Panel>
      <Panel title="Logos" aside="PNG · shown in the app, sign-in screens and admin menu">
        <div className="grid gap-4 md:grid-cols-3">
          {LOGOS.map((l) => {
            const path = String(assets[l.key] || "");
            return (
              <div key={l.variant} className="flex flex-col gap-3 rounded-[18px] border border-sfx-line p-4">
                <div>
                  <p className="text-[14px] font-medium text-sfx-text">{l.label}</p>
                  <p className="text-[12px] text-sfx-muted">{l.hint}</p>
                </div>
                <div className={`flex h-28 items-center justify-center rounded-[14px] border border-sfx-line ${l.bg}`}>
                  {path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getPublicAssetUrl(path)} alt={l.label} className="max-h-20 max-w-[80%] object-contain" />
                  ) : (
                    <span className="text-[12px] text-sfx-muted">Default</span>
                  )}
                </div>
                <label className="inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-sfx-surface-2 text-[13px] font-semibold text-sfx-text hover:brightness-125">
                  <ImageUp size={15} /> {busy === l.variant ? "Uploading…" : path ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png"
                    className="sr-only"
                    disabled={busy === l.variant}
                    onChange={(e) => {
                      upload(l.variant, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ── Appearance: theme for every app user ────────────────────────── */

const THEMES: Array<{ value: AppTheme; label: string; note: string; icon: typeof Sun }> = [
  { value: "dark", label: "Dark", note: "Black and gold (default)", icon: Moon },
  { value: "light", label: "Light", note: "Warm white and gold", icon: Sun },
  { value: "system", label: "System", note: "Follows each phone or computer", icon: Monitor },
];

function AppearanceSection() {
  const [theme, setTheme] = useState<AppTheme | null>(null);
  const [allowUser, setAllowUser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let alive = true;
    getBrandingAssets().then(
      (b) => alive && (setTheme(b.appTheme || "dark"), setAllowUser(Boolean(b.allowUserTheme))),
      (e) => alive && (setTheme("dark"), setMsg({ tone: "danger", text: errText(e, "Couldn’t load the theme.") }))
    );
    return () => {
      alive = false;
    };
  }, []);

  const save = async (next: AppTheme, allow: boolean) => {
    setTheme(next);
    setAllowUser(allow);
    setBusy(true);
    setMsg(null);
    try {
      applyBrandingAssets(await updateAppTheme(next, allow));
      setMsg({ tone: "success", text: "Saved. Clients get this theme the next time they open the app." });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Couldn’t save the theme.") });
    } finally {
      setBusy(false);
    }
  };

  if (!theme) return <Loading rows={2} />;

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Panel title="App theme" aside="For every client using the app">
        <div role="radiogroup" aria-label="App theme" className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => save(t.value, allowUser)}
                className={cn(
                  "flex items-center gap-3 rounded-[12px] border p-4 text-left transition disabled:opacity-60",
                  active ? "border-sfx-border-strong bg-sfx-gold-soft" : "border-sfx-line bg-sfx-surface-2 hover:border-sfx-border"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-sfx-gold text-sfx-on-gold" : "bg-sfx-surface-solid text-sfx-accent"
                  )}
                >
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-sfx-text">{t.label}</span>
                  <span className="block text-[12px] text-sfx-muted">{t.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t border-sfx-line">
          <Toggle
            label="Let clients choose their own theme"
            description="When on, clients can switch Dark / Light / System in their Settings. When off, everyone sees the theme above."
            checked={allowUser}
            onChange={(v) => save(theme, v)}
          />
        </div>
      </Panel>
      <Panel title="Admin panel theme">
        <p className="text-[13px] text-sfx-muted">
          The admin panel has its own theme, saved on this computer. Use the sun / moon / screen switch at the top of any admin page.
        </p>
      </Panel>
    </div>
  );
}

/* ── Deposit wallets ──────────────────────────────────────────────── */

function PaymentsSection() {
  const [setup, setSetup] = useState<PaymentSetupConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const apply = (s: PaymentSetupConfig) => {
    setSetup(s);
    setDrafts(Object.fromEntries(NETWORKS.map((n) => [n, s.networks?.[n]?.walletAddress || ""])));
  };

  useEffect(() => {
    let alive = true;
    getAdminPaymentSetup().then(
      (s) => alive && apply(s),
      (e) => alive && setMsg({ tone: "danger", text: errText(e, "Couldn’t load deposit wallets.") })
    );
    return () => {
      alive = false;
    };
  }, []);

  const run = async (key: string, fn: () => Promise<PaymentSetupConfig>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      apply(await fn());
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "That didn’t work.") });
    } finally {
      setBusy(null);
    }
  };

  if (!setup) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Loading rows={3} />;

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">
        Clients can only deposit on a network that has an address here. Double-check every address — funds sent to a wrong address can’t be recovered.
      </Alert>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        {NETWORKS.map((n) => {
          const cfg = setup.networks?.[n] || { walletAddress: "", qrCodePath: "" };
          const live = Boolean(cfg.walletAddress?.trim());
          const draft = drafts[n] ?? "";
          return (
            <Panel key={n} title={`USDT · ${n}`} aside={<span className={live ? "text-sfx-success" : "text-sfx-muted"}>{live ? "● Live" : "Not set"}</span>}>
              <div className="flex flex-col gap-4">
                <Field label="Company wallet address" value={draft} onChange={(e) => setDrafts((d) => ({ ...d, [n]: e.target.value }))} autoComplete="off" spellCheck={false} />
                <Btn
                  loading={busy === `addr-${n}`}
                  disabled={draft.trim() === (cfg.walletAddress || "").trim()}
                  onClick={() => run(`addr-${n}`, () => updateAdminPaymentSetup({ walletAddresses: { [n]: draft.trim() } }), `${n} address saved.`)}
                >
                  Save address
                </Btn>
                <div className="flex items-center gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[14px] border border-sfx-line bg-white">
                    {cfg.qrCodePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getPublicAssetUrl(cfg.qrCodePath)} alt={`${n} QR code`} className="h-full w-full rounded-[14px] object-contain p-1.5" />
                    ) : (
                      <span className="px-2 text-center text-[11px] text-neutral-500">No QR</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[12px] bg-sfx-surface-2 px-3 text-[13px] font-semibold text-sfx-text hover:brightness-125">
                      <ImageUp size={14} /> {busy === `qr-${n}` ? "Uploading…" : cfg.qrCodePath ? "Replace QR" : "Upload QR"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) run(`qr-${n}`, () => uploadAdminPaymentQr(n, f), `${n} QR updated.`);
                        }}
                      />
                    </label>
                    {cfg.qrCodePath && (
                      <Btn variant="ghost" className="h-[30px] justify-start px-0" loading={busy === `rmqr-${n}`} onClick={() => run(`rmqr-${n}`, () => deleteAdminPaymentQr(n), `${n} QR removed.`)}>
                        <Trash2 size={14} /> Remove QR
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

/* ── Data export / reset ──────────────────────────────────────────── */

function DataSection() {
  const [tables, setTables] = useState<DataTableInfo[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const load = () =>
    getDataTables().then(setTables, (e) => {
      setTables([]);
      setMsg({ tone: "danger", text: errText(e, "Couldn’t load tables.") });
    });

  useEffect(() => {
    let alive = true;
    getDataTables().then(
      (t) => alive && setTables(t),
      (e) => alive && (setTables([]), setMsg({ tone: "danger", text: errText(e, "Couldn’t load tables.") }))
    );
    return () => {
      alive = false;
    };
  }, []);

  const doExport = async () => {
    setBusy("export");
    setMsg(null);
    try {
      await exportDataTables(picked);
      setMsg({ tone: "success", text: picked.length ? `Exported ${picked.length} table${picked.length === 1 ? "" : "s"}.` : "Exported all tables." });
    } catch (e) {
      setMsg({ tone: "danger", text: errText(e, "Export failed.") });
    } finally {
      setBusy(null);
    }
  };

  if (!tables) return <Loading rows={3} />;

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Panel
        title="Data tables"
        aside={
          <button type="button" className="text-sfx-gold hover:underline" onClick={() => setPicked(picked.length === tables.length ? [] : tables.map((t) => t.key))}>
            {picked.length === tables.length ? "Clear selection" : "Select all"}
          </button>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-3 rounded-[14px] border border-sfx-line px-4 py-3">
              <Checkbox checked={picked.includes(t.key)} onChange={(on) => setPicked((p) => (on ? [...p, t.key] : p.filter((k) => k !== t.key)))}>
                <span className="text-[13px] text-sfx-text">{t.label}</span>
              </Checkbox>
              <span className="text-[12px] tabular-nums text-sfx-muted">{t.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn variant="danger" disabled={!picked.length} onClick={() => setResetOpen(true)}>
            <Trash2 size={15} /> Reset selected
          </Btn>
          <Btn loading={busy === "export"} onClick={doExport}>
            <Download size={15} /> {picked.length ? "Export selected" : "Export all"}
          </Btn>
        </div>
      </Panel>

      {resetOpen && (
        <ResetDialog
          tables={tables.filter((t) => picked.includes(t.key))}
          onClose={() => setResetOpen(false)}
          onDone={(text) => {
            setResetOpen(false);
            setPicked([]);
            setMsg({ tone: "success", text });
            load();
          }}
        />
      )}
    </div>
  );
}

function ResetDialog({ tables, onClose, onDone }: { tables: DataTableInfo[]; onClose: () => void; onDone: (t: string) => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Permanently delete data?"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            loading={busy}
            disabled={confirm !== "RESET"}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                const r = await resetDataTables(
                  tables.map((t) => t.key),
                  confirm
                );
                onDone(`Deleted ${r.reduce((a, x) => a + x.deletedCount, 0).toLocaleString()} records from ${r.length} table${r.length === 1 ? "" : "s"}.`);
              } catch (e) {
                setErr(errText(e, "Reset failed."));
                setBusy(false);
              }
            }}
          >
            Delete data
          </Btn>
        </>
      }
    >
      <p className="text-[14px] text-sfx-muted">Every record in these tables will be deleted. This can’t be undone — export first if you may need it.</p>
      <ul className="my-4 flex flex-wrap gap-2">
        {tables.map((t) => (
          <li key={t.key} className="rounded-[10px] bg-sfx-danger/15 px-2.5 py-1 text-[12px] text-sfx-danger">
            {t.label} · {t.count.toLocaleString()}
          </li>
        ))}
      </ul>
      <Field label="Type RESET to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      {err && <Alert className="mt-4">{err}</Alert>}
    </Dialog>
  );
}
