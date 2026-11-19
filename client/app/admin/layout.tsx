"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Diamond } from "lucide-react";

import { AccountMenu, AdminAccountSlot, AdminShell, Btn, Dialog } from "@/components/admin/ui";
import { Alert, Field } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { changeUserPassword, logoutUser } from "@/services/auth.service";
import { getSession } from "@/services/session.service";

/** Admin area: separate sign-in, admin-only guard, Aurum admin frame. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, user, setUser } = useHydratedUser();
  const [pwOpen, setPwOpen] = useState(false);
  const isLogin = pathname.startsWith("/admin/login");

  useEffect(() => {
    if (isLogin || loading) return;
    if (!user) {
      const persisted = getSession()?.user || null;
      if (persisted) setUser(persisted);
      else router.replace("/admin/login");
      return;
    }
    if (user.role !== "admin") router.replace("/dashboard");
  }, [isLogin, loading, router, setUser, user]);

  if (isLogin) return <>{children}</>;

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="sfx sfx-page flex items-center justify-center">
        <Diamond size={40} className="animate-pulse text-sfx-gold" />
      </div>
    );
  }

  const initials =
    (user.fullName || "Admin")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "AD";

  const signOut = async () => {
    try {
      await logoutUser();
    } finally {
      router.replace("/admin/login");
    }
  };

  return (
    <AdminAccountSlot.Provider value={<AccountMenu initials={initials} onChangePassword={() => setPwOpen(true)} onSignOut={signOut} />}>
      <AdminShell>{children}</AdminShell>
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </AdminAccountSlot.Provider>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setMsg(null);
    onClose();
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!current || !next) return setMsg({ tone: "danger", text: "Fill in all fields." });
    if (next.length < 8) return setMsg({ tone: "danger", text: "The new password needs at least 8 characters." });
    if (next !== confirm) return setMsg({ tone: "danger", text: "The new passwords don’t match." });
    setBusy(true);
    setMsg(null);
    try {
      await changeUserPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ tone: "success", text: "Password changed." });
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof Error ? err.message : "Couldn’t change the password. Check the current one." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Change password"
      footer={
        <>
          <Btn variant="secondary" onClick={close}>
            Close
          </Btn>
          <Btn onClick={() => submit()} loading={busy}>
            Update password
          </Btn>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="At least 8 characters" />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
