import type { AudioFormat, Track } from "../types";

export interface CloudUser {
  id: string;
  username: string;
  email: string;
  created_at: number;
  role: "user" | "admin";
}

export interface CloudSong {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  cover_url: string | null;
  added_at: number | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  stream_url?: string;
  stream_expires_at?: number;
}

export interface CloudState {
  ready: boolean;
  user: CloudUser | null;
  expiresAt: number | null;
}

interface SessionPayload {
  user: CloudUser;
  accessToken?: string;
  token?: string;
  expiresAt: number;
}

export class CloudError extends Error {
  constructor(message: string, public status = 0, public code = "NETWORK_ERROR") {
    super(message);
  }
}

const DEFAULT_WORKER = "https://storage-cloudflare-worker.mr-hackerdon808.workers.dev";
const configured = import.meta.env?.VITE_CLOUD_API_URL || DEFAULT_WORKER;
const parsedBase = new URL(configured);
if (parsedBase.protocol !== "https:" || parsedBase.username || parsedBase.password) {
  throw new Error("The cloud music API must be an HTTPS URL without credentials");
}
const API_ORIGIN = parsedBase.origin;

function userFrom(value: unknown): CloudUser {
  const user = value as Partial<CloudUser> | null;
  if (!user || typeof user.id !== "string" || typeof user.email !== "string" || typeof user.username !== "string") {
    throw new CloudError("The cloud API returned an invalid account", 502, "INVALID_RESPONSE");
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: Number(user.created_at || 0),
    role: user.role === "admin" ? "admin" : "user",
  };
}

function songFrom(value: unknown): CloudSong {
  const song = value as Partial<CloudSong> | null;
  if (!song || typeof song.id !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(song.id) || typeof song.title !== "string") {
    throw new CloudError("The cloud API returned an invalid song", 502, "INVALID_RESPONSE");
  }
  let streamUrl: string | undefined;
  if (song.stream_url) {
    const url = new URL(song.stream_url, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/stream/")) {
      throw new CloudError("The cloud API returned an untrusted stream URL", 502, "INVALID_RESPONSE");
    }
    streamUrl = url.href;
  }
  let cover: string | null = null;
  if (typeof song.cover_url === "string" && (
    /^https:\/\/[^\s]+$/i.test(song.cover_url) ||
    /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(song.cover_url)
  )) cover = song.cover_url;
  return {
    id: song.id,
    title: song.title.slice(0, 500),
    artist: typeof song.artist === "string" ? song.artist : null,
    album: typeof song.album === "string" ? song.album : null,
    duration: Number.isFinite(Number(song.duration)) ? Number(song.duration) : 0,
    cover_url: cover,
    added_at: Number(song.added_at || 0),
    mime_type: typeof song.mime_type === "string" ? song.mime_type : null,
    file_size: Number(song.file_size || 0),
    uploaded_by: typeof song.uploaded_by === "string" ? song.uploaded_by : null,
    stream_url: streamUrl,
    stream_expires_at: Number(song.stream_expires_at || 0),
  };
}

function cloudFormat(mime: string | null): AudioFormat {
  if (mime?.includes("flac")) return "FLAC";
  if (mime?.includes("wav")) return "WAV";
  if (mime?.includes("mpeg")) return "MP3";
  if (mime?.includes("ogg")) return "OGG";
  if (mime?.includes("aac") || mime?.includes("mp4") || mime?.includes("m4a")) return "AAC";
  return "OTHER";
}

export function cloudSongToTrack(value: unknown): Track {
  const song = songFrom(value);
  const addedAt = song.added_at && song.added_at < 1e12 ? song.added_at * 1000 : song.added_at || Date.now();
  return {
    id: `cloud_${song.id}`,
    cloudId: song.id,
    storage: "cloud",
    title: song.title,
    artist: song.artist || "Unknown artist",
    album: song.album || "Cloud library",
    duration: song.duration || 0,
    format: cloudFormat(song.mime_type),
    bitrate: song.mime_type ? `Cloud · ${song.mime_type}` : "Cloud stream",
    isHiRes: false,
    coverArt: song.cover_url || undefined,
    audioUrl: song.stream_url,
    addedAt,
    playCount: 0,
    fileSizeMB: song.file_size ? song.file_size / 1048576 : undefined,
    uploadedBy: song.uploaded_by || undefined,
    streamExpiresAt: song.stream_expires_at,
    mimeType: song.mime_type || undefined,
  };
}

class CloudClient {
  private accessToken: string | null = null;
  private initializePromise: Promise<CloudUser | null> | null = null;
  private refreshPromise: Promise<CloudUser> | null = null;
  private listeners = new Set<(state: CloudState) => void>();
  private state: CloudState = { ready: false, user: null, expiresAt: null };

  get snapshot(): CloudState {
    return { ...this.state };
  }

  subscribe = (listener: (state: CloudState) => void): (() => void) => {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private setSession(payload: SessionPayload): CloudUser {
    const token = payload.accessToken || payload.token;
    if (!token) throw new CloudError("The cloud API did not return an access token", 502, "INVALID_RESPONSE");
    this.accessToken = token;
    this.state = { ready: true, user: userFrom(payload.user), expiresAt: Number(payload.expiresAt) };
    this.emit();
    return this.state.user;
  }

  private clearSession(): void {
    this.accessToken = null;
    this.state = { ...this.state, ready: true, user: null, expiresAt: null };
    this.emit();
  }

  private async raw(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    try {
      response = await fetch(`${API_ORIGIN}${path}`, {
        ...init,
        credentials: "include",
        headers,
        signal: init.signal || AbortSignal.timeout(35000),
      });
    } catch (error) {
      throw new CloudError(error instanceof Error && error.name === "TimeoutError"
        ? "The cloud request timed out. Check your connection and try again."
        : "Could not reach the cloud music service. Check your connection.");
    }
    return response;
  }

  private async payload(response: Response): Promise<any> {
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      throw new CloudError("The cloud API returned an unexpected response", response.status, "INVALID_RESPONSE");
    }
    const data = await response.json();
    if (!response.ok) {
      throw new CloudError(typeof data.error === "string" ? data.error : `Cloud request failed (${response.status})`, response.status, data.code || "API_ERROR");
    }
    return data;
  }

  private refresh = async (): Promise<CloudUser> => {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const response = await this.raw("/auth/refresh", { method: "POST" });
          const data = await this.payload(response);
          return this.setSession(data as SessionPayload);
        } catch (error) {
          this.clearSession();
          throw error;
        } finally {
          // The promise is cleared after all awaiters receive the same rotation.
          queueMicrotask(() => { this.refreshPromise = null; });
        }
      })();
    }
    return this.refreshPromise;
  };

  initialize = (): Promise<CloudUser | null> => {
    if (!this.initializePromise) {
      this.initializePromise = (async () => {
        try {
          return await this.refresh();
        } catch (error) {
          this.state = { ...this.state, ready: true };
          this.emit();
          if (error instanceof CloudError && error.status === 401) return null;
          throw error;
        }
      })();
    }
    return this.initializePromise;
  };

  private async validToken(): Promise<string> {
    if (this.accessToken && this.state.expiresAt && this.state.expiresAt > Date.now() + 30000) return this.accessToken;
    await this.refresh();
    if (!this.accessToken) throw new CloudError("Sign in to continue", 401, "AUTH_REQUIRED");
    return this.accessToken;
  }

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<any> {
    const token = await this.validToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await this.raw(path, { ...init, headers });
    if (response.status === 401 && retry) {
      await this.refresh();
      return this.request(path, init, false);
    }
    return this.payload(response);
  }

  register = async (username: string, email: string, password: string, confirmPassword: string): Promise<CloudUser> => {
    const response = await this.raw("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, confirmPassword }),
    });
    return this.setSession(await this.payload(response));
  };

  login = async (email: string, password: string): Promise<CloudUser> => {
    const response = await this.raw("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return this.setSession(await this.payload(response));
  };

  logout = async (): Promise<void> => {
    try {
      await this.raw("/auth/logout", { method: "POST" });
    } finally {
      this.clearSession();
    }
  };

  me = async (): Promise<CloudUser> => userFrom((await this.request("/auth/me")).user);
  refreshSession = async (): Promise<CloudUser> => this.refresh();

  listSongs = async (): Promise<CloudSong[]> => {
    const data = this.state.user || this.accessToken
      ? await this.request("/songs")
      : await this.payload(await this.raw("/songs"));
    if (!Array.isArray(data.songs)) throw new CloudError("The cloud API returned an invalid song list", 502, "INVALID_RESPONSE");
    return data.songs.map(songFrom);
  };

  deleteSong = async (id: string): Promise<void> => {
    await this.request(`/songs/${encodeURIComponent(id)}`, { method: "DELETE" });
  };

  adminUsers = async (): Promise<CloudUser[]> => {
    const data = await this.request("/admin/users");
    return Array.isArray(data.users) ? data.users.map(userFrom) : [];
  };

  changeRole = async (id: string, role: "user" | "admin"): Promise<CloudUser> => {
    const data = await this.request(`/admin/users/${encodeURIComponent(id)}/role`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    return userFrom(data.user);
  };

  private uploadOnce(file: File, fields: Record<string, string>, token: string, onProgress?: (percent: number) => void): Promise<CloudSong> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_ORIGIN}/upload`);
      xhr.withCredentials = true;
      xhr.timeout = 600000;
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener("error", () => reject(new CloudError("Upload failed. Check your connection and try again.")));
      xhr.addEventListener("timeout", () => reject(new CloudError("Upload timed out. Try again on a more stable connection.", 0, "UPLOAD_TIMEOUT")));
      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new CloudError(data.error || `Upload failed (${xhr.status})`, xhr.status, data.code || "UPLOAD_FAILED"));
          } else {
            onProgress?.(100);
            resolve(songFrom(data.song));
          }
        } catch (error) {
          reject(error instanceof CloudError ? error : new CloudError("The upload returned an invalid response", xhr.status, "INVALID_RESPONSE"));
        }
      });
      const form = new FormData();
      form.set("file", file);
      Object.entries(fields).forEach(([key, value]) => form.set(key, value));
      xhr.send(form);
    });
  }

  uploadSong = async (
    file: File,
    fields: Record<string, string>,
    onProgress?: (percent: number) => void,
  ): Promise<CloudSong> => {
    const token = await this.validToken();
    try {
      return await this.uploadOnce(file, fields, token, onProgress);
    } catch (error) {
      if (error instanceof CloudError && error.status === 401) {
        await this.refresh();
        return this.uploadOnce(file, fields, await this.validToken(), onProgress);
      }
      throw error;
    }
  };
}

export const cloudClient = new CloudClient();
export const cloudApiOrigin = API_ORIGIN;
