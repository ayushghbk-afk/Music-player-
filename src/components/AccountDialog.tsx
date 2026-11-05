import React, { useState } from "react";
import { CalendarDays, CloudUpload, LoaderCircle, LogOut, Mail, RefreshCw, ShieldCheck, UserRound, X } from "lucide-react";
import { cloudClient, type CloudUser } from "../services/cloud";
import { useDialogFocus } from "./useDialogFocus";

export function AccountDialog({
  user,
  isOpen,
  onClose,
  onUpload,
  onAdmin,
  onLogout,
}: {
  user: CloudUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void;
  onAdmin: () => void;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"refresh" | "logout" | null>(null);
  const [message, setMessage] = useState("");
  const ref = useDialogFocus(isOpen, () => { if (!busy) onClose(); });
  if (!isOpen || !user) return null;
  const created = user.created_at < 1e12 ? user.created_at * 1000 : user.created_at;
  const expires = cloudClient.snapshot.expiresAt;
  const run = async (kind: "refresh" | "logout", action: () => Promise<void>) => {
    setBusy(kind); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "The request failed"); } finally { setBusy(null); }
  };
  return (
    <div className="dialog-backdrop account-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="account-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header className="dialog-heading">
          <span className="tool-card-icon"><UserRound size={21} /></span>
          <button className="icon-button" aria-label="Close account settings" disabled={!!busy} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="eyebrow">YOUR AETHER ACCOUNT</div>
        <h2 id="account-title">{user.username}</h2>
        <span className={`account-role ${user.role}`}><ShieldCheck size={13} /> {user.role === "admin" ? "Administrator" : "Listener account"}</span>
        <dl className="account-details">
          <div><dt><UserRound size={14} /> Username</dt><dd>{user.username}</dd></div>
          <div><dt><Mail size={14} /> Email</dt><dd>{user.email}</dd></div>
          <div><dt><CalendarDays size={14} /> Member since</dt><dd>{created ? new Date(created).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Not available"}</dd></div>
        </dl>
        <section className="account-settings-section">
          <h3>Cloud library</h3>
          <p>Upload audio, stream the shared catalog, and manage your own uploads. Your local files remain on this device.</p>
          <button className="button-primary" onClick={onUpload}><CloudUpload size={14} /> Upload music</button>
          {user.role === "admin" && <button className="button-secondary" onClick={onAdmin}><ShieldCheck size={14} /> Open admin dashboard</button>}
        </section>
        <section className="account-settings-section">
          <h3>Session & security</h3>
          <p>Access tokens stay in memory and expire after 15 minutes. The rotating refresh cookie keeps you signed in without storing a password in the browser.</p>
          <small>{expires ? `Current access token valid until ${new Date(expires).toLocaleTimeString()}.` : "Session restored securely."}</small>
          <button className="button-secondary" disabled={!!busy} onClick={() => void run("refresh", async () => { await cloudClient.refreshSession(); setMessage("Session and account role refreshed."); })}>
            <RefreshCw size={14} className={busy === "refresh" ? "loading-spinner" : ""} /> {busy === "refresh" ? "Refreshing…" : "Refresh session"}
          </button>
        </section>
        {message && <p className="account-message" role="status">{message}</p>}
        <button className="account-logout" disabled={!!busy} onClick={() => void run("logout", onLogout)}>
          <LogOut size={15} /> {busy === "logout" ? "Signing out…" : "Sign out on this device"}
        </button>
      </section>
    </div>
  );
}
