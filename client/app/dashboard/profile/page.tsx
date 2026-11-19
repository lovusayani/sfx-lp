"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Camera,
  CircleHelp,
  FileText,
  Info,
  LifeBuoy,
  LogOut,
  Pencil,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Skeleton } from "@/components/sfx/ActivityList";
import { MenuList, MenuRow, Sheet } from "@/components/sfx/kit";
import { Alert, Button, Chip, Field, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getPublicAssetUrl } from "@/services/api";
import { logoutUser } from "@/services/auth.service";
import { updateProfile, uploadProfileAvatar } from "@/services/user.service";
import { KycStatus } from "@/types";

const KYC: Record<KycStatus, { label: string; tone: "gold" | "success" | "danger" | "neutral"; href: string }> = {
  approved: { label: "VERIFIED", tone: "gold", href: "/kyc/status" },
  pending: { label: "IN REVIEW", tone: "neutral", href: "/kyc/status" },
  rejected: { label: "ACTION NEEDED", tone: "danger", href: "/kyc/status" },
  not_submitted: { label: "UNVERIFIED", tone: "neutral", href: "/kyc" },
};

/** Profile: identity, personal details and the account menu (phones have no sidebar). */
export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, setUser } = useHydratedUser();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  if (loading || !user) {
    return (
      <div className="flex flex-col gap-[19px]">
        <TopBar backHref="/dashboard" caption="PROFILE" />
        <Skeleton className="h-[180px]" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const kyc = KYC[user.kycStatus || "not_submitted"];
  const initials =
    (user.fullName || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "SL";

  const onAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage({ tone: "danger", text: "Choose a JPG, PNG or WEBP image." });
    setUploading(true);
    setMessage(null);
    try {
      setUser(await uploadProfileAvatar(file));
      setMessage({ tone: "success", text: "Profile photo updated." });
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message : "Could not upload the photo." });
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    await logoutUser().catch(() => undefined);
    router.replace("/login");
  };

  return (
    <div className="sfx-enter flex flex-col gap-[19px]">
      <TopBar backHref="/dashboard" caption="PROFILE" />

      <div className="grid gap-[19px] lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-[19px]">
          <section className="sfx-card flex flex-col items-center gap-3 px-6 pb-7 pt-8 text-center" aria-label="Your profile">
            <div className="relative">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getPublicAssetUrl(user.avatar)}
                  alt=""
                  className="h-24 w-24 rounded-full border border-sfx-border-strong object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-sfx-border-strong bg-sfx-gold-soft text-[30px] font-semibold text-sfx-accent">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-sfx-border-strong bg-sfx-gold text-sfx-on-gold disabled:opacity-60"
              >
                <Camera size={16} />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatar} />
            </div>
            <div className="mt-1">
              <h1 className="text-[22px] font-bold text-sfx-text">{user.fullName || "Your name"}</h1>
              <p className="text-[13px] text-sfx-muted">{user.email}</p>
            </div>
            <Chip tone={kyc.tone}>{kyc.label}</Chip>
          </section>

          {message && <Alert tone={message.tone}>{message.text}</Alert>}

          <section className="sfx-card p-[21px]" aria-label="Personal details">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-sfx-text">Personal details</h2>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-[30px] bg-sfx-gold-soft px-3 py-1.5 text-[12px] font-semibold text-sfx-accent hover:brightness-110"
              >
                <Pencil size={13} /> Edit
              </button>
            </div>
            <dl className="divide-y divide-sfx-line text-[14px]">
              <Row label="Full name" value={user.fullName || "—"} />
              <Row label="Mobile" value={user.phone?.trim() || "Not added"} />
              <Row label="Email" value={user.email} />
              <Row label="Account" value={user.status === "active" ? "Active" : "Suspended"} />
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-[19px]">
          <MenuList>
            <MenuRow href={kyc.href} icon={ShieldCheck} label="Identity verification" value={kyc.label.toLowerCase()} />
            <MenuRow href="/dashboard/performance" icon={TrendingUp} label="Performance" />
            <MenuRow href="/dashboard/profile/reports" icon={FileText} label="Reports & statements" />
            <MenuRow href="/dashboard/notices" icon={Bell} label="Notices" />
            <MenuRow href="/dashboard/settings" icon={Settings} label="Settings" />
          </MenuList>
          <MenuList>
            <MenuRow href="/dashboard/support" icon={LifeBuoy} label="Support" />
            <MenuRow href="/dashboard/help" icon={BookOpen} label="Help" />
            <MenuRow href="/dashboard/faq" icon={CircleHelp} label="FAQ" />
            <MenuRow href="/dashboard/about" icon={Info} label="About" />
          </MenuList>
          <MenuList>
            <MenuRow onClick={signOut} icon={LogOut} label="Sign out" danger />
          </MenuList>
        </div>
      </div>

      <DetailsSheet
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ fullName: user.fullName || "", phone: user.phone || "" }}
        onSaved={(u) => {
          setUser(u);
          setEditing(false);
          setMessage({ tone: "success", text: "Your details were updated." });
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sfx-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sfx-text">{value}</dd>
    </div>
  );
}

function DetailsSheet({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: { fullName: string; phone: string };
  onSaved: (user: Awaited<ReturnType<typeof updateProfile>>) => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(initial.fullName);
      setPhone(initial.phone);
      setError("");
    }
  }, [open, initial.fullName, initial.phone]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    setBusy(true);
    setError("");
    try {
      onSaved(await updateProfile({ fullName: fullName.trim(), phone: phone.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit details">
      <form onSubmit={save} className="flex flex-col gap-5">
        <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        <Field label="Mobile number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+41 …" />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </form>
    </Sheet>
  );
}
