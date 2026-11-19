"use client";

import { useEffect, useState } from "react";

import { Segmented, Toggle } from "@/components/sfx/kit";
import { Alert, Button, Display, Eyebrow, TopBar } from "@/components/sfx/ui";
import { setFrontendTheme } from "@/components/theme/FrontendThemeController";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { disablePushNotifications, enablePushNotifications } from "@/services/push-notifications.service";
import { setTwoFactorEmail } from "@/services/auth.service";
import { updateSettings } from "@/services/user.service";
import { UserSettings } from "@/types";

const DEFAULTS: UserSettings = { theme: "dark", fontSize: 16, notificationSound: true, alerts: true };
const SIZES = [
  { value: "14", label: "Small" },
  { value: "16", label: "Default" },
  { value: "18", label: "Large" },
];

/** Appearance and notification preferences (saved to the account). */
export default function SettingsPage() {
  const { user, setUser } = useHydratedUser();
  const [form, setForm] = useState<UserSettings>(DEFAULTS);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  useEffect(() => {
    if (user?.settings) setForm({ ...DEFAULTS, ...user.settings });
  }, [user?.settings]);

  // Appearance previews immediately; everything is persisted on save.
  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setMessage(null);
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "theme") setFrontendTheme(value as UserSettings["theme"]);
    if (key === "fontSize") document.documentElement.style.fontSize = `${value}px`;
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSettings(form);
      if (updated.alerts) await enablePushNotifications().catch(() => undefined);
      else await disablePushNotifications().catch(() => undefined);
      if (user) setUser({ ...user, settings: updated });
      setMessage({ tone: "success", text: "Settings saved." });
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof Error ? e.message : "Could not save settings." });
    } finally {
      setSaving(false);
    }
  };

  const sizeValue = String(form.fontSize <= 14 ? 14 : form.fontSize >= 18 ? 18 : 16);

  return (
    <div className="sfx-enter flex max-w-[720px] flex-col gap-[19px]">
      <TopBar caption="SETTINGS" />
      <Display size="md" title="Settings" />

      <section className="sfx-card flex flex-col gap-5 p-[21px]" aria-label="Appearance">
        <h2 className="text-[16px] font-semibold text-sfx-text">Appearance</h2>
        <div className="flex flex-col gap-2">
          <Eyebrow>Theme</Eyebrow>
          <Segmented
            label="Theme"
            value={form.theme}
            onChange={(v) => set("theme", v)}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Eyebrow>Text size</Eyebrow>
          <Segmented label="Text size" value={sizeValue} onChange={(v) => set("fontSize", Number(v))} options={SIZES} />
        </div>
      </section>

      <section className="sfx-card px-[21px] py-2" aria-label="Notifications">
        <h2 className="pt-3 text-[16px] font-semibold text-sfx-text">Notifications</h2>
        <div className="divide-y divide-sfx-line">
          <Toggle
            label="Push notifications"
            description="Deposits, withdrawals and notices on this device"
            checked={form.alerts}
            onChange={(v) => set("alerts", v)}
          />
          <Toggle
            label="Sound"
            description="Play a sound for new notifications"
            checked={form.notificationSound}
            onChange={(v) => set("notificationSound", v)}
          />
        </div>
      </section>

      <section className="sfx-card px-[21px] py-2" aria-label="Security">
        <h2 className="pt-3 text-[16px] font-semibold text-sfx-text">Security</h2>
        <Toggle
          label="Email code at sign-in"
          description={twoFaBusy ? "Saving…" : `A six-digit code is sent to ${user?.email || "your email"} each time you sign in`}
          checked={Boolean(user?.twoFactorEmail)}
          onChange={async (v) => {
            if (!user || twoFaBusy) return;
            setTwoFaBusy(true);
            setMessage(null);
            try {
              setUser(await setTwoFactorEmail(v));
              setMessage({ tone: "success", text: v ? "Sign-in codes are on." : "Sign-in codes are off." });
            } catch (e) {
              setMessage({ tone: "danger", text: e instanceof Error ? e.message : "Couldn't change sign-in codes." });
            } finally {
              setTwoFaBusy(false);
            }
          }}
        />
      </section>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button onClick={save} loading={saving}>
        Save settings
      </Button>
    </div>
  );
}
