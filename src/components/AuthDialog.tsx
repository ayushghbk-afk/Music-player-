import React, { useEffect, useState } from "react";
import { AudioLines, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { cloudClient } from "../services/cloud";
import { useDialogFocus } from "./useDialogFocus";

export type AuthMode = "login" | "register";

export function passwordFeedback(password: string): string | null {
  if (password.length < 12 || password.length > 128) return "Use 12–128 characters.";
  if (/^(password|qwerty|letmein|welcome|admin|iloveyou)/i.test(password)) return "Choose a less common password.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return classes < 3 ? "Include at least three of: lowercase, uppercase, numbers, symbols." : null;
}

export function AuthDialog({
  isOpen,
  initialMode,
  onClose,
}: {
  isOpen: boolean;
  initialMode: AuthMode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus(isOpen, () => { if (!busy) onClose(); });

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;
  const switchMode = (next: AuthMode) => {
    if (busy) return;
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "register") {
      if (username.trim().length < 3 || username.trim().length > 32) {
        setError("Username must be 3–32 characters.");
        return;
      }
      const problem = passwordFeedback(password);
      if (problem) { setError(problem); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
    try {
      if (mode === "login") await cloudClient.login(cleanEmail, password);
      else await cloudClient.register(username.trim(), cleanEmail, password, confirmPassword);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop auth-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section ref={dialogRef} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header className="auth-heading">
          <span className="auth-mark"><AudioLines size={23} /></span>
          <button className="icon-button" aria-label="Close authentication" disabled={busy} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="eyebrow">YOUR MUSIC, WHEREVER YOU LISTEN</div>
        <h2 id="auth-title">{mode === "login" ? "Welcome back to your listening room." : "Make room for your music."}</h2>
        <p className="auth-intro">{mode === "login"
          ? "Sign in to stream cloud tracks and manage your uploads."
          : "Create a free account for private cloud uploads and cross-device listening."}</p>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Sign in</button>
          <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>Username
              <input autoFocus autoComplete="username" name="username" required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="How your library knows you" disabled={busy} />
            </label>
          )}
          <label>Email
            <input autoFocus={mode === "login"} autoComplete="email" name="email" type="email" inputMode="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} />
          </label>
          <label>Password
            <span className="password-field">
              <input autoComplete={mode === "login" ? "current-password" : "new-password"} name="password" type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Your password"} disabled={busy} />
              <button type="button" className="icon-button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </span>
          </label>
          {mode === "register" && (
            <>
              <label>Confirm password
                <input autoComplete="new-password" name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" disabled={busy} />
              </label>
              <p className={`password-guidance ${password && passwordFeedback(password) ? "needs-work" : ""}`}>
                <LockKeyhole size={13} /> {password ? passwordFeedback(password) || "Your password meets the strength requirements." : "12+ characters with a mix of character types."}
              </p>
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button-primary auth-submit" type="submit" disabled={busy}>
            {busy && <LoaderCircle size={15} className="loading-spinner" />}
            {busy ? "Securing your session…" : mode === "login" ? "Sign in to Aether" : "Create my account"}
          </button>
        </form>
        <p className="auth-security"><ShieldCheck size={14} /><span>Passwords are hashed with scrypt. Refresh sessions use secure, rotating HttpOnly cookies. Admin accounts cannot be created here.</span></p>
      </section>
    </div>
  );
}
