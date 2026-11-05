import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, CloudUpload, LoaderCircle, LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import type { CloudUser } from "../services/cloud";

export function AccountMenu({
  user,
  ready,
  onLogin,
  onProfile,
  onUpload,
  onAdmin,
  onLogout,
}: {
  user: CloudUser | null;
  ready: boolean;
  onLogin: () => void;
  onProfile: () => void;
  onUpload: () => void;
  onAdmin: () => void;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => { if (!user) setOpen(false); }, [user]);

  if (!ready) return <span className="account-loading" aria-label="Restoring cloud session"><LoaderCircle size={16} className="loading-spinner" /></span>;
  if (!user) return <button className="account-sign-in" onClick={onLogin}><UserRound size={15} /><span>Sign in</span></button>;

  const action = (callback: () => void) => { setOpen(false); callback(); };
  return (
    <div className="account-menu" ref={root}>
      <button className="account-trigger" aria-label={`Account: ${user.username}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="profile-avatar">{user.username.trim().charAt(0).toUpperCase() || "A"}</span>
        <span className="account-trigger-name">{user.username}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-summary">
            <strong>{user.username}</strong>
            <span>{user.email}</span>
            <small className={user.role === "admin" ? "admin-badge" : ""}>{user.role === "admin" ? <ShieldCheck size={11} /> : <UserRound size={11} />}{user.role === "admin" ? "Administrator" : "Listener"}</small>
          </div>
          <button onClick={() => action(onProfile)}><Settings2 size={15} /> Profile & account settings</button>
          <button onClick={() => action(onUpload)}><CloudUpload size={15} /> Upload to cloud library</button>
          {user.role === "admin" && <button onClick={() => action(onAdmin)}><ShieldCheck size={15} /> Admin dashboard</button>}
          <button disabled={busy} onClick={async () => {
            setBusy(true);
            try { await onLogout(); setOpen(false); } finally { setBusy(false); }
          }}><LogOut size={15} /> {busy ? "Signing out…" : "Sign out"}</button>
        </div>
      )}
    </div>
  );
}
