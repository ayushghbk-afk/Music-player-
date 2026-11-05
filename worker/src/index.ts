import { B2Storage } from "./b2";
import { signToken, verifyToken, type TokenClaims } from "./jwt";
import { hashPassword, passwordProblem, verifyDummyPassword, verifyPassword } from "./passwords";
import { migrateDatabase } from "./schema";
import { TursoDatabase } from "./turso";
import {
  HttpError,
  type AuthContext,
  type Database,
  type Env,
  type ObjectStorage,
  type SongRow,
  type UserRow,
  type WorkerDependencies,
} from "./types";
import {
  REFRESH_COOKIE,
  boundedSeconds,
  clearRefreshCookie,
  clientIp,
  failure,
  integer,
  jsonResponse,
  parseCookies,
  refreshCookie,
  requestOrigin,
  requiredId,
  sha256,
  success,
  bytesToHex,
  text,
} from "./utils";

const ACCESS_SECONDS = 900;
const REFRESH_SECONDS = 30 * 86400;
const STREAM_SECONDS = 12 * 3600;
const MAX_UPLOAD = 100 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SONG_SELECT = "SELECT id,title,artist,album,duration,cover_url,added_at,b2_key,mime_type,file_size,uploaded_by FROM songs";

interface AudioKind {
  extension: string;
  format: string;
  mime: string;
  aliases: string[];
}

const AUDIO_TYPES: Record<string, AudioKind> = {
  mp3: { extension: "mp3", format: "MP3", mime: "audio/mpeg", aliases: ["audio/mpeg", "audio/mp3"] },
  m4a: { extension: "m4a", format: "M4A", mime: "audio/mp4", aliases: ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"] },
  aac: { extension: "aac", format: "AAC", mime: "audio/aac", aliases: ["audio/aac", "audio/x-aac"] },
  wav: { extension: "wav", format: "WAV", mime: "audio/wav", aliases: ["audio/wav", "audio/x-wav", "audio/wave"] },
  ogg: { extension: "ogg", format: "OGG", mime: "audio/ogg", aliases: ["audio/ogg", "application/ogg"] },
  flac: { extension: "flac", format: "FLAC", mime: "audio/flac", aliases: ["audio/flac", "audio/x-flac"] },
};

function publicUser(row: Record<string, unknown>): UserRow {
  return {
    id: text(row.id as never),
    username: text(row.username as never),
    email: text(row.email as never),
    created_at: integer(row.created_at as never),
    role: row.role === "admin" ? "admin" : "user",
  };
}

function publicSong(row: Record<string, unknown>): SongRow {
  return {
    id: text(row.id as never),
    title: text(row.title as never),
    artist: row.artist == null ? null : text(row.artist as never),
    album: row.album == null ? null : text(row.album as never),
    duration: row.duration == null ? null : integer(row.duration as never),
    cover_url: row.cover_url == null ? null : text(row.cover_url as never),
    added_at: row.added_at == null ? null : integer(row.added_at as never),
    b2_key: row.b2_key == null ? null : text(row.b2_key as never),
    mime_type: row.mime_type == null ? null : text(row.mime_type as never),
    file_size: row.file_size == null ? null : integer(row.file_size as never),
    uploaded_by: row.uploaded_by == null ? null : text(row.uploaded_by as never),
  };
}

function safeUser(row: Record<string, unknown>): UserRow {
  const user = publicUser(row);
  if (!user.id) throw new HttpError(401, "ACCOUNT_UNAVAILABLE", "This account is no longer available");
  return user;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 32 * 1024) throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Object required");
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Send a valid JSON object");
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}

function validUsername(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 32 && !/[\x00-\x1f\x7f]/.test(value);
}

async function consumeRateLimit(
  database: Database,
  request: Request,
  bucket: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const windowStarted = now - (now % windowMs);
  const digest = await sha256(`${bucket}:${clientIp(request)}:${identity.toLowerCase()}`);
  const key = bytesToHex(digest);
  const result = await database.query(
    `INSERT INTO rate_limits(key,window_started,hits) VALUES(?,?,1)
     ON CONFLICT(key) DO UPDATE SET
       hits=CASE WHEN excluded.window_started>rate_limits.window_started THEN 1 ELSE rate_limits.hits+1 END,
       window_started=CASE WHEN excluded.window_started>rate_limits.window_started THEN excluded.window_started ELSE rate_limits.window_started END
     RETURNING hits,window_started`,
    [key, windowStarted],
  );
  const hits = integer(result.rows[0]?.hits);
  if (hits > limit) {
    const retry = Math.max(1, Math.ceil((windowStarted + windowMs - now) / 1000));
    throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.", { "Retry-After": String(retry) });
  }
}

async function userById(database: Database, id: string): Promise<UserRow | null> {
  const result = await database.query("SELECT id,username,email,created_at,role FROM users WHERE id=? LIMIT 1", [id]);
  return result.rows[0] ? safeUser(result.rows[0]) : null;
}

async function requireSession(database: Database, claims: TokenClaims): Promise<AuthContext> {
  const session = await database.query(
    "SELECT id FROM auth_sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>? LIMIT 1",
    [claims.sid, claims.sub, Date.now()],
  );
  if (!session.rows.length) throw new HttpError(401, "SESSION_REVOKED", "Your session has ended. Sign in again.");
  const user = await userById(database, claims.sub);
  if (!user) throw new HttpError(401, "ACCOUNT_UNAVAILABLE", "This account is no longer available");
  return { user, sessionId: claims.sid };
}

async function requireUser(request: Request, database: Database, env: Env): Promise<AuthContext> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTH_REQUIRED", "Sign in to continue");
  }
  const claims = await verifyToken(env.AUTH_SECRET, authorization.slice(7).trim(), "access");
  return requireSession(database, claims);
}

async function optionalUser(request: Request, database: Database, env: Env): Promise<AuthContext | null> {
  return request.headers.has("Authorization") ? requireUser(request, database, env) : null;
}

async function createSessionResponse(
  database: Database,
  env: Env,
  user: UserRow,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const refreshSeconds = boundedSeconds(env.REFRESH_TOKEN_SECONDS, REFRESH_SECONDS, 3600, 90 * 86400);
  const accessSeconds = boundedSeconds(env.ACCESS_TOKEN_SECONDS, ACCESS_SECONDS, 300, 3600);
  const access = await signToken(env.AUTH_SECRET, {
    sub: user.id,
    sid: sessionId,
    typ: "access",
    expiresIn: accessSeconds,
  });
  const refresh = await signToken(env.AUTH_SECRET, {
    sub: user.id,
    sid: sessionId,
    typ: "refresh",
    expiresIn: refreshSeconds,
  });
  const refreshHash = bytesToHex(await sha256(refresh.token));
  if (Math.random() < 0.02) {
    await database.query("DELETE FROM auth_sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)", [now, now - 7 * 86400000]);
    await database.query("DELETE FROM rate_limits WHERE window_started<?", [now - 7 * 86400000]);
  }
  await database.query(
    "INSERT INTO auth_sessions(id,user_id,refresh_token_hash,created_at,expires_at,last_used_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)",
    [sessionId, user.id, refreshHash, now, access.expiresAt - accessSeconds * 1000 + refreshSeconds * 1000, now],
  );
  return success(
    { user, accessToken: access.token, token: access.token, expiresAt: access.expiresAt },
    corsHeaders,
    { "Set-Cookie": refreshCookie(refresh.token, refreshSeconds) },
  );
}

function streamUrl(origin: string, songId: string, token: string): string {
  return `${origin}/stream/${encodeURIComponent(songId)}?ticket=${encodeURIComponent(token)}`;
}

async function songWithStream(
  database: Database,
  env: Env,
  auth: AuthContext,
  song: SongRow,
  origin: string,
): Promise<Omit<SongRow, "b2_key"> & { stream_url: string; stream_expires_at: number }> {
  const seconds = boundedSeconds(env.STREAM_TICKET_SECONDS, STREAM_SECONDS, 900, 86400);
  const ticket = await signToken(env.AUTH_SECRET, {
    sub: auth.user.id,
    sid: auth.sessionId,
    typ: "stream",
    song: song.id,
    expiresIn: seconds,
  });
  return { ...withoutStorageKey(song), stream_url: streamUrl(origin, song.id, ticket.token), stream_expires_at: ticket.expiresAt };
}

function withoutStorageKey(song: SongRow): Omit<SongRow, "b2_key"> {
  const { b2_key: _privateKey, ...metadata } = song;
  return metadata;
}

function audioKind(fileName: string, declaredMime: string, bytes: Uint8Array): AudioKind {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const kind = AUDIO_TYPES[extension === "oga" ? "ogg" : extension === "wave" ? "wav" : extension];
  if (!kind) throw new HttpError(415, "UNSUPPORTED_AUDIO", "Use MP3, M4A, AAC, WAV, OGG, or FLAC audio");
  const mime = declaredMime.toLowerCase().split(";")[0]!.trim();
  if (mime && mime !== "application/octet-stream" && !kind.aliases.includes(mime)) {
    throw new HttpError(415, "MIME_MISMATCH", "The audio MIME type does not match its file extension");
  }
  let detected = "";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") detected = "wav";
  else if (ascii(0, 4) === "fLaC") detected = "flac";
  else if (ascii(0, 4) === "OggS") detected = "ogg";
  else if (bytes.length >= 12 && ascii(4, 8) === "ftyp") detected = "m4a";
  else if (ascii(0, 3) === "ID3") detected = "mp3";
  else if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    detected = (bytes[1]! & 0x06) === 0 ? "aac" : "mp3";
  }
  // ID3 tags can precede an AAC stream only in mislabeled files; reject ambiguity.
  if (detected !== kind.format.toLowerCase() && !(kind.extension === "m4a" && detected === "m4a")) {
    throw new HttpError(415, "AUDIO_SIGNATURE_MISMATCH", "The file contents do not match the supported audio format");
  }
  return kind;
}

function metadataText(value: FormDataEntryValue | null, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
  return (clean || fallback).slice(0, max);
}

function coverUrl(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.length > 1_400_000) throw new HttpError(400, "COVER_TOO_LARGE", "Cover artwork is too large");
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[^\s]*)?$/.test(value)) return value;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  throw new HttpError(400, "INVALID_COVER", "Cover art must be an HTTPS URL or embedded raster image");
}

function songIdFromPath(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const remainder = pathname.slice(prefix.length);
  return remainder && !remainder.includes("/") ? requiredId(decodeURIComponent(remainder)) : null;
}

export function createHandler(dependencies: WorkerDependencies = {}) {
  let database: Database | null = dependencies.database || null;
  let storage: ObjectStorage | null = dependencies.storage || null;
  let migration: Promise<void> | null = null;

  const getDatabase = (env: Env) => database || (database = new TursoDatabase(env));
  const getStorage = (env: Env) => storage || (storage = new B2Storage(env));
  const ready = async (env: Env) => {
    const db = getDatabase(env);
    if (!migration) {
      migration = migrateDatabase(db).catch((error) => {
        migration = null;
        throw error;
      });
    }
    await migration;
    return db;
  };

  return async function fetchHandler(request: Request, env: Env): Promise<Response> {
    const { allowed, corsHeaders } = requestOrigin(request, env);
    if (!allowed) {
      return jsonResponse(403, { success: false, error: "Origin not allowed", code: "ORIGIN_DENIED" }, {});
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type,Range",
          "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag,Retry-After",
          "Access-Control-Max-Age": "7200",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    try {
      const db = await ready(env);
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "") || "/";
      const origin = url.origin;

      if (path === "/health" && request.method === "GET") {
        await db.query("SELECT 1 AS healthy");
        await getStorage(env).check();
        return success({
          status: "ok",
          message: "Turso and Backblaze B2 connections successful",
          database: "Turso connected",
          storage: "Backblaze B2 connected",
        }, corsHeaders);
      }

      if (path === "/auth/register" && request.method === "POST") {
        const body = await readJson(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const username = typeof body.username === "string" ? body.username.trim() : "";
        if (!validUsername(username)) throw new HttpError(400, "INVALID_USERNAME", "Username must be 3–32 characters without control characters");
        if (!validEmail(email)) throw new HttpError(400, "INVALID_EMAIL", "Enter a valid email address");
        const problem = passwordProblem(body.password);
        if (problem) throw new HttpError(400, "WEAK_PASSWORD", problem);
        if (body.confirmPassword !== body.password) throw new HttpError(400, "PASSWORD_MISMATCH", "Passwords do not match");
        await consumeRateLimit(db, request, "register-ip", "", 10, 3600000);
        const passwordHash = await hashPassword(body.password as string);
        const id = crypto.randomUUID();
        const inserted = await db.query(
          `INSERT INTO users(id,username,email,password_hash,created_at,role)
           SELECT ?,?,?,?,?,'user'
           WHERE NOT EXISTS(SELECT 1 FROM users WHERE lower(email)=lower(?) OR lower(username)=lower(?))`,
          [id, username, email, passwordHash, Date.now(), email, username],
        );
        if (!inserted.affected) throw new HttpError(409, "ACCOUNT_EXISTS", "An account with this email or username already exists");
        return createSessionResponse(db, env, { id, username, email, created_at: Date.now(), role: "user" }, corsHeaders);
      }

      if (path === "/auth/login" && request.method === "POST") {
        const body = await readJson(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!validEmail(email) || !password || password.length > 128) {
          throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
        }
        await consumeRateLimit(db, request, "login-account", email, 8, 900000);
        await consumeRateLimit(db, request, "login-ip", "", 30, 900000);
        const result = await db.query("SELECT id,username,email,password_hash,created_at,role FROM users WHERE lower(email)=lower(?) LIMIT 1", [email]);
        const row = result.rows[0];
        if (!row) {
          await verifyDummyPassword(password);
          throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
        }
        const valid = await verifyPassword(password, text(row.password_hash as never));
        if (!valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
        return createSessionResponse(db, env, safeUser(row), corsHeaders);
      }

      if (path === "/auth/refresh" && request.method === "POST") {
        const token = parseCookies(request.headers.get("Cookie"))[REFRESH_COOKIE];
        if (!token) throw new HttpError(401, "NO_SESSION", "No saved session");
        let claims: TokenClaims;
        try {
          claims = await verifyToken(env.AUTH_SECRET, token, "refresh");
        } catch (error) {
          if (error instanceof HttpError && error.status === 401) {
            throw new HttpError(error.status, error.code, error.message, { "Set-Cookie": clearRefreshCookie() });
          }
          throw error;
        }
        const result = await db.query("SELECT refresh_token_hash,expires_at,revoked_at FROM auth_sessions WHERE id=? AND user_id=? LIMIT 1", [claims.sid, claims.sub]);
        const session = result.rows[0];
        const tokenHash = bytesToHex(await sha256(token));
        if (!session || session.revoked_at != null || integer(session.expires_at as never) <= Date.now()) {
          throw new HttpError(401, "SESSION_REVOKED", "Your session has ended. Sign in again.", { "Set-Cookie": clearRefreshCookie() });
        }
        if (session.refresh_token_hash !== tokenHash) {
          // A rotated token was replayed: revoke the whole session, including the newest token.
          await db.query("UPDATE auth_sessions SET revoked_at=? WHERE id=?", [Date.now(), claims.sid]);
          throw new HttpError(401, "SESSION_REPLAY", "Session reuse was detected. Sign in again.", { "Set-Cookie": clearRefreshCookie() });
        }
        const user = await userById(db, claims.sub);
        if (!user) throw new HttpError(401, "ACCOUNT_UNAVAILABLE", "This account is no longer available");
        const refreshSeconds = boundedSeconds(env.REFRESH_TOKEN_SECONDS, REFRESH_SECONDS, 3600, 90 * 86400);
        const remaining = Math.max(1, Math.floor((integer(session.expires_at as never) - Date.now()) / 1000));
        const access = await signToken(env.AUTH_SECRET, {
          sub: user.id, sid: claims.sid, typ: "access",
          expiresIn: boundedSeconds(env.ACCESS_TOKEN_SECONDS, ACCESS_SECONDS, 300, 3600),
        });
        const refresh = await signToken(env.AUTH_SECRET, {
          sub: user.id, sid: claims.sid, typ: "refresh", expiresIn: Math.min(refreshSeconds, remaining),
        });
        const updated = await db.query(
          "UPDATE auth_sessions SET refresh_token_hash=?,last_used_at=? WHERE id=? AND refresh_token_hash=? AND revoked_at IS NULL",
          [bytesToHex(await sha256(refresh.token)), Date.now(), claims.sid, tokenHash],
        );
        if (!updated.affected) throw new HttpError(401, "SESSION_REPLAY", "This session was already refreshed. Sign in again.");
        return success({ user, accessToken: access.token, token: access.token, expiresAt: access.expiresAt }, corsHeaders, {
          "Set-Cookie": refreshCookie(refresh.token, Math.min(refreshSeconds, remaining)),
        });
      }

      if (path === "/auth/logout" && request.method === "POST") {
        const cookies = parseCookies(request.headers.get("Cookie"));
        const refresh = cookies[REFRESH_COOKIE];
        try {
          if (refresh) {
            const claims = await verifyToken(env.AUTH_SECRET, refresh, "refresh");
            await db.query("UPDATE auth_sessions SET revoked_at=? WHERE id=?", [Date.now(), claims.sid]);
          } else if (request.headers.has("Authorization")) {
            const auth = await requireUser(request, db, env);
            await db.query("UPDATE auth_sessions SET revoked_at=? WHERE id=?", [Date.now(), auth.sessionId]);
          }
        } catch (error) {
          if (!(error instanceof HttpError) || error.status !== 401) throw error;
        }
        return success({ message: "Signed out" }, corsHeaders, { "Set-Cookie": clearRefreshCookie() });
      }

      if (path === "/auth/me" && request.method === "GET") {
        const auth = await requireUser(request, db, env);
        return success({ user: auth.user }, corsHeaders);
      }

      if (path === "/songs" && request.method === "GET") {
        const auth = await optionalUser(request, db, env);
        const result = await db.query(`${SONG_SELECT} ORDER BY added_at DESC`);
        const songs = [];
        for (const row of result.rows) {
          const song = publicSong(row);
          songs.push(auth ? await songWithStream(db, env, auth, song, origin) : withoutStorageKey(song));
        }
        return success({ songs }, corsHeaders);
      }

      if (path === "/upload" && request.method === "POST") {
        const auth = await requireUser(request, db, env);
        await consumeRateLimit(db, request, "upload-user", auth.user.id, 30, 3600000);
        const maxBytes = boundedSeconds(env.MAX_UPLOAD_BYTES, MAX_UPLOAD, 1024, MAX_UPLOAD);
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > maxBytes + 1024 * 1024) throw new HttpError(413, "FILE_TOO_LARGE", `Audio files must not exceed ${Math.floor(maxBytes / 1048576)} MB`);
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          throw new HttpError(400, "INVALID_MULTIPART", "Upload audio as multipart/form-data");
        }
        const uploaded = form.get("file") || form.get("audio");
        if (!uploaded || typeof uploaded === "string") throw new HttpError(400, "FILE_REQUIRED", "Choose an audio file");
        if (!uploaded.size || uploaded.size > maxBytes) throw new HttpError(413, "FILE_TOO_LARGE", `Audio files must not exceed ${Math.floor(maxBytes / 1048576)} MB`);
        const bytes = new Uint8Array(await uploaded.arrayBuffer());
        const kind = audioKind(uploaded.name, uploaded.type, bytes);
        const durationValue = Number(form.get("duration") || 0);
        const duration = Number.isFinite(durationValue) ? Math.max(0, Math.min(86400, Math.round(durationValue))) : 0;
        const id = crypto.randomUUID();
        const key = `audio/${auth.user.id}/${id}.${kind.extension}`;
        const title = metadataText(form.get("title"), uploaded.name.replace(/\.[^.]+$/, ""), 500);
        const artist = metadataText(form.get("artist"), "Unknown artist", 500);
        const album = metadataText(form.get("album"), "Cloud uploads", 500);
        const artwork = coverUrl(form.get("cover_url"));
        await getStorage(env).put(key, bytes.buffer, kind.mime);
        try {
          await db.query(
            `INSERT INTO songs(id,title,artist,album,duration,cover_url,added_at,b2_key,mime_type,file_size,uploaded_by)
             VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            [id, title, artist, album, duration, artwork, Date.now(), key, kind.mime, uploaded.size, auth.user.id],
          );
        } catch (error) {
          try {
            await getStorage(env).delete(key);
          } catch {
            console.error(`Upload compensation failed for object ${key}`);
          }
          throw error;
        }
        const song = publicSong((await db.query(`${SONG_SELECT} WHERE id=?`, [id])).rows[0]!);
        return jsonResponse(201, {
          success: true,
          song: await songWithStream(db, env, auth, song, origin),
        }, corsHeaders);
      }

      const streamId = songIdFromPath(path, "/stream/");
      if (streamId && request.method === "GET") {
        const ticket = url.searchParams.get("ticket");
        let auth: AuthContext;
        if (ticket) {
          const claims = await verifyToken(env.AUTH_SECRET, ticket, "stream");
          if (claims.song !== streamId) throw new HttpError(403, "STREAM_TOKEN_MISMATCH", "This stream ticket is for a different song");
          auth = await requireSession(db, claims);
        } else {
          auth = await requireUser(request, db, env);
        }
        void auth; // Both paths require an active user and unrevoked session.
        const result = await db.query("SELECT id,b2_key,mime_type,file_size FROM songs WHERE id=? LIMIT 1", [streamId]);
        const song = result.rows[0];
        if (!song || !song.b2_key) throw new HttpError(404, "SONG_NOT_FOUND", "Song not found");
        const range = request.headers.get("Range");
        if (range && !/^bytes=\d*-\d*$/.test(range)) throw new HttpError(416, "INVALID_RANGE", "Requested range is not valid");
        const upstream = await getStorage(env).get(text(song.b2_key as never), range);
        const headers = new Headers(corsHeaders);
        for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"]) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        if (!headers.has("Content-Type")) headers.set("Content-Type", text(song.mime_type as never, "application/octet-stream"));
        if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "private, no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Access-Control-Expose-Headers", "Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag");
        return new Response(upstream.status === 416 ? null : upstream.body, { status: upstream.status, headers });
      }

      const deleteId = songIdFromPath(path, "/songs/");
      if (deleteId && request.method === "DELETE") {
        const auth = await requireUser(request, db, env);
        const result = await db.query("SELECT id,uploaded_by,b2_key FROM songs WHERE id=? LIMIT 1", [deleteId]);
        const song = result.rows[0];
        if (!song) throw new HttpError(404, "SONG_NOT_FOUND", "Song not found");
        if (auth.user.role !== "admin" && song.uploaded_by !== auth.user.id) {
          throw new HttpError(403, "NOT_SONG_OWNER", "You can only delete your own uploads");
        }
        if (song.b2_key) await getStorage(env).delete(text(song.b2_key as never));
        try {
          await db.query("DELETE FROM songs WHERE id=?", [deleteId]);
        } catch {
          throw new HttpError(502, "METADATA_DELETE_FAILED", "The audio object was deleted but metadata cleanup failed. Retry the delete or contact an administrator.");
        }
        return success({ message: "Song deleted", id: deleteId }, corsHeaders);
      }

      if (path === "/admin/users" && request.method === "GET") {
        const auth = await requireUser(request, db, env);
        if (auth.user.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        const users = (await db.query("SELECT id,username,email,created_at,role FROM users ORDER BY created_at DESC")).rows.map(publicUser);
        return success({ users }, corsHeaders);
      }

      const roleMatch = /^\/admin\/users\/([A-Za-z0-9._-]{1,160})\/role$/.exec(path);
      if (roleMatch && request.method === "POST") {
        const auth = await requireUser(request, db, env);
        if (auth.user.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access is required");
        const targetId = roleMatch[1]!;
        if (targetId === auth.user.id) throw new HttpError(409, "SELF_ROLE_CHANGE", "Use another administrator to change your own role");
        const body = await readJson(request);
        if (body.role !== "user" && body.role !== "admin") throw new HttpError(400, "INVALID_ROLE", "Role must be user or admin");
        const target = await userById(db, targetId);
        if (!target) throw new HttpError(404, "USER_NOT_FOUND", "User not found");
        if (target.role === "admin" && body.role === "user") {
          const admins = integer((await db.query("SELECT COUNT(*) AS count FROM users WHERE role='admin'")).rows[0]?.count);
          if (admins <= 1) throw new HttpError(409, "LAST_ADMIN", "The last administrator cannot be demoted");
        }
        await db.query("UPDATE users SET role=? WHERE id=?", [body.role, targetId]);
        return success({ user: { ...target, role: body.role } }, corsHeaders);
      }

      throw new HttpError(404, "NOT_FOUND", "API endpoint not found");
    } catch (error) {
      if (error instanceof HttpError) return failure(error, corsHeaders);
      console.error("Worker request failed:", error instanceof Error ? error.message : "Unknown error");
      return failure(new HttpError(500, "INTERNAL_ERROR", "The request could not be completed"), corsHeaders);
    }
  };
}

const handler = createHandler();
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handler(request, env);
  },
};
