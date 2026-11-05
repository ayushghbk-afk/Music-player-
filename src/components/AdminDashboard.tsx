import React, { useCallback, useEffect, useState } from "react";
import { Cloud, LoaderCircle, Music2, RefreshCw, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { cloudClient, type CloudUser } from "../services/cloud";
import type { Track } from "../types";
import { timeLabel } from "./Artwork";

export function AdminDashboard({
  currentUser,
  tracks,
  onDeleteTrack,
  onRefresh,
}: {
  currentUser: CloudUser;
  tracks: Track[];
  onDeleteTrack: (id: string) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const [users, setUsers] = useState<CloudUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cloudTracks = tracks.filter((track) => track.storage === "cloud");

  const loadUsers = useCallback(async () => {
    setLoading(true); setError("");
    try { setUsers(await cloudClient.adminUsers()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load users"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const changeRole = async (user: CloudUser, role: "user" | "admin") => {
    if (role === "user" && !confirm(`Remove administrator access from ${user.username}?`)) return;
    setBusy(`role-${user.id}`); setError(""); setNotice("");
    try {
      await cloudClient.changeRole(user.id, role);
      setNotice(`${user.username} is now ${role === "admin" ? "an administrator" : "a listener"}.`);
      await loadUsers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Role update failed"); }
    finally { setBusy(""); }
  };

  const remove = async (track: Track) => {
    if (!confirm(`Permanently delete “${track.title}” and its private B2 audio object?`)) return;
    setBusy(`song-${track.id}`); setError(""); setNotice("");
    try { await onDeleteTrack(track.id); setNotice(`${track.title} was deleted from B2 and Turso.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Song deletion failed"); }
    finally { setBusy(""); }
  };

  return (
    <div className="admin-dashboard">
      <div className="page-intro">
        <div><div className="eyebrow">OWNER-CONTROLLED ACCESS</div><h1>Keep the listening room in order.</h1><p>Manage accounts, roles, and every cloud upload. Local device libraries remain private to their devices.</p></div>
        <span className="quality-pill"><ShieldCheck size={11} /> ADMIN DASHBOARD</span>
      </div>
      <div className="admin-stat-grid">
        <article><Users size={19} /><span>Registered accounts</span><strong>{users.length}</strong></article>
        <article><ShieldCheck size={19} /><span>Administrators</span><strong>{users.filter((user) => user.role === "admin").length}</strong></article>
        <article><Music2 size={19} /><span>Cloud tracks</span><strong>{cloudTracks.length}</strong></article>
        <article><Cloud size={19} /><span>Uploaded audio</span><strong>{(cloudTracks.reduce((sum, track) => sum + (track.fileSizeMB || 0), 0)).toFixed(1)} MB</strong></article>
      </div>
      <div className="admin-toolbar">
        <div><h2>User accounts</h2><p>Roles are verified from Turso on every protected request.</p></div>
        <button className="button-secondary" disabled={loading} onClick={() => { void loadUsers(); void onRefresh(); }}><RefreshCw size={14} className={loading ? "loading-spinner" : ""} /> Refresh</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-panel">
        {loading && users.length === 0 ? <p className="admin-loading"><LoaderCircle size={17} className="loading-spinner" /> Loading user accounts…</p> : (
          <div className="admin-user-list">
            <div className="admin-user-head"><span>USER</span><span>CREATED</span><span>ROLE</span><span>ACTION</span></div>
            {users.map((user) => {
              const created = user.created_at < 1e12 ? user.created_at * 1000 : user.created_at;
              const self = user.id === currentUser.id;
              return (
                <div className="admin-user-row" key={user.id}>
                  <div className="admin-user-identity"><span>{user.username.charAt(0).toUpperCase()}</span><div><strong>{user.username}{self && <small>You</small>}</strong><small>{user.email}</small></div></div>
                  <time>{created ? new Date(created).toLocaleDateString() : "—"}</time>
                  <span className={`account-role ${user.role}`}>{user.role === "admin" ? <ShieldCheck size={12} /> : <UserRound size={12} />}{user.role}</span>
                  <button className="button-secondary" disabled={self || busy === `role-${user.id}`} title={self ? "Another administrator must change your role" : `Change ${user.username}'s role`} onClick={() => void changeRole(user, user.role === "admin" ? "user" : "admin")}>
                    {busy === `role-${user.id}` ? <LoaderCircle size={13} className="loading-spinner" /> : null}{user.role === "admin" ? "Make listener" : "Make admin"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div className="admin-toolbar cloud-songs-heading"><div><h2>Cloud song management</h2><p>Administrators can delete any upload. Deletion removes the B2 object before its Turso record.</p></div><span>{cloudTracks.length} tracks · {timeLabel(cloudTracks.reduce((sum, track) => sum + track.duration, 0))}</span></div>
      <section className="admin-panel admin-song-panel">
        {!cloudTracks.length ? <div className="admin-empty"><Music2 size={25} /><strong>No cloud uploads yet</strong><p>Uploaded tracks will appear here for moderation.</p></div> : cloudTracks.map((track) => (
          <div className="admin-song-row" key={track.id}>
            <div><strong>{track.title}</strong><span>{track.artist} · {track.album}</span><small>{users.find((user) => user.id === track.uploadedBy)?.username || (track.uploadedBy === currentUser.id ? currentUser.username : "Unknown uploader")} · {track.format} · {(track.fileSizeMB || 0).toFixed(2)} MB</small></div>
            <button className="danger-action" disabled={busy === `song-${track.id}`} onClick={() => void remove(track)}>{busy === `song-${track.id}` ? <LoaderCircle size={14} className="loading-spinner" /> : <Trash2 size={14} />} Delete</button>
          </div>
        ))}
      </section>
      <p className="admin-security-note"><ShieldCheck size={14} /> The first administrator is promoted only through owner-run Turso SQL. Registration never accepts an admin role.</p>
    </div>
  );
}
