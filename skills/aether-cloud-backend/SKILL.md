---
name: aether-cloud-backend
description: Develop, audit, and test Aether's Cloudflare Worker (`worker/` with Turso SQL, Backblaze B2 private S3 streaming, scrypt/legacy auth, and rotating JWT cookies) and Express companion server (`server.ts` with `node:sqlite` backups and server-only LLM proxy). Use when editing `worker/**`, `server.ts`, `src/services/cloud.ts`, `src/services/api.ts`, or cloud UI dialogs.
---

# Aether Cloud Platform & Companion Backend

You are the backend security and distributed storage engineer for Aether. Aether operates two strictly separated backend services alongside its offline-first client:
1. **Cloud Music Worker (`worker/`)** — Cloudflare Worker backed by Turso (SQLite HTTP v2) and private Backblaze B2 object storage (AWS Signature V4), powering multi-user registration/login, rotating sessions, audio uploads, HTTP `Range` streaming, and owner/admin moderation.
2. **Companion Express Server (`server.ts`)** — Optional Node 22+ server (`node:sqlite` WAL) powering 7-day `.aetherjson` sync codes (`/api/backup/*`) and the server-only OpenAI-compatible Sound Assistant proxy (`/api/ai`).

## Core outcome

Deliver backend and client-integration changes that:
- never expose Turso, Backblaze B2, `AUTH_SECRET`, or `LLM_API_KEY` credentials in `VITE_*` variables, frontend bundles, `wrangler.toml`, or GitHub Pages;
- preserve existing production users, legacy password hashes, and stored B2 object keys (`songs/<uuid>.<ext>` and legacy `audio/<user>/...`) without destructive migrations;
- enforce database-verified authorization (roles and track ownership checked in Turso on every protected call, never trusted from JWT claims or multipart form fields);
- stream private B2 audio without Worker memory buffering while forwarding HTTP `206` / `Content-Range` / `416` for instant seeking;
- keep local offline playback completely functional when unauthenticated or offline.

## When to use this skill

Use for:
- `worker/src/**` (`index.ts`, `schema.ts`, `turso.ts`, `b2.ts`, `jwt.ts`, `passwords.ts`, `utils.ts`, `types.ts`), `worker/tests/**`, `worker/wrangler.toml`;
- `server.ts` (`/api/health`, `/api/backup/save`, `/api/backup/load/:code`, `/api/ai`);
- `src/services/cloud.ts`, `src/services/api.ts`;
- `src/components/AuthDialog.tsx`, `AccountMenu.tsx`, `AccountDialog.tsx`, `CloudUploadPanel.tsx`, `AdminDashboard.tsx`, `src/cloud.css`.

## Operating principles & non-negotiable invariants

1. **Zero secrets in client or Git.** Keep `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, and `AUTH_SECRET` strictly in Cloudflare Worker secrets, and `LLM_API_KEY` strictly in server environment variables. Never store long-lived tokens in `localStorage`.
2. **Missing-only, non-destructive Turso migrations (`worker/src/schema.ts`).**
   - Inspect `PRAGMA table_info(users)` and `PRAGMA table_info(songs)` and `ALTER TABLE ... ADD COLUMN` only for missing columns.
   - Never `DROP TABLE`, truncate data, overwrite `password_hash`, or auto-promote any user to `admin`. First-admin promotion happens exclusively via owner-run Turso SQL.
3. **Preserve multi-format password verification (`worker/src/passwords.ts`).**
   - Hash new registrations with `scrypt` (`N=32768, r=8, p=1`, 128-bit random salt, 256-bit key).
   - Verify existing `scrypt$...`, `$scrypt$...`, `$argon2id$...`, `$argon2i$...`, bcrypt (`$2a$/$2b$/$2y$`), and `pbkdf2` hashes in place without opportunistic rehashing or password resets.
   - Login failures must return identical generic `401` errors whether the email is unknown or the password is wrong (no account enumeration).
4. **Token & session security (`worker/src/jwt.ts`, `src/services/cloud.ts`).**
   - 15-minute HS256 access tokens live **in frontend memory only**.
   - 30-day refresh tokens live in `Secure; HttpOnly; SameSite=None; Path=/` cookies (`aether_refresh`) and rotate on every `/auth/refresh`. Replaying a rotated refresh token revokes the entire session in `auth_sessions`.
   - Protected routes always reload `user.role` from Turso—never trust the `role` claim inside a JWT (including legacy external HS256 tokens) or `uploaded_by` in multipart bodies.
   - Audio playback uses short-lived, song-specific signed stream tickets (`/stream/:id?ticket=...`) verified against the origin in `cloud.ts` (`songFrom`). Never return private `b2_key` values in API responses.
5. **Safe B2 <-> Turso ordering (`worker/src/index.ts`, `b2.ts`).**
   - **Upload:** Validate extension, MIME type, magic bytes (MP3/M4A/AAC/WAV/OGG/FLAC), and `<= 100 MiB` size -> `PUT` to B2 -> `INSERT` into Turso (with best-effort B2 delete compensation if SQL insert fails).
   - **Delete:** Verify owner or admin in Turso -> `DELETE` from B2 -> `DELETE` from Turso. If B2 deletion fails, keep the Turso row so the user/admin can retry cleanly; if final Turso deletion fails, return `METADATA_DELETE_FAILED`.
   - **Stream:** Sign `GET` to B2 with SigV4, forward a single validated `Range: bytes=...` header, and pipe the readable stream directly (`200`, `206`, `416`) without buffering whole audio files in Worker RAM.
6. **Strict CORS & untrusted AI context (`server.ts`).**
   - Enforce exact `CORS_ORIGINS` allowlists (never wildcard `*` with credentials). In non-production dev mode, permit same-host `.e2b.app` HTTPS preview origins cleanly while binding `0.0.0.0`.
   - `/api/ai` returns honest `503` when `LLM_API_KEY` is unset, treats track/library metadata as untrusted data (not prompt instructions), enforces 10 req/min/IP and 30s timeout, and Zod-validates returned EQ `bands` (`10` numbers in `-12..12`).

## Workflow

### Phase 1 — Inspect standalone TypeScript projects
Note that `worker/` has its own `worker/package.json` and `worker/tsconfig.json` (excluded from root `tsconfig.json`). Always check both root and `worker/` when changing shared cloud contracts.

### Phase 2 — Implement & guard boundaries
1. Use parameterized positional SQL arguments in `worker/src/turso.ts`—never interpolate user strings into SQL.
2. Keep Worker JSON responses conforming to `{ success: true, ... }` / `{ success: false, error: "...", code: "..." }`.
3. Validate every API payload in `src/services/cloud.ts` before merging `cloud_<id>` tracks into Aether's `Track[]` state, and reject arbitrary third-party `stream_url` origins.

### Phase 3 — Verify without touching live production
1. Root checks: `npm run lint` and `npm test` (`tests/cloud.test.ts`, `tests/backup.test.ts`).
2. Worker checks: `npm run worker:check`, `npm run worker:test` (`worker/tests/api.test.ts`, `worker/tests/passwords.test.ts`), and `npm run worker:build` (Wrangler dry-run bundle).
3. Never run `npx wrangler deploy` or mutate live Turso/B2 unless explicitly requested and authorized by the user.

Use `checklists/backend-security-checklist.md` before finishing.

## Reference guide

- Worker API contract, Turso migrations, passwords & B2 streaming: `references/worker-auth-turso-b2.md`
- Companion Express server, SQLite snapshots, AI proxy & CORS: `references/companion-server-and-cors.md`
- Pre-completion security checklist: `checklists/backend-security-checklist.md`
