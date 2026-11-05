# Aether Cloud Worker

Complete Cloudflare Worker backend for the existing Aether Music Player. It connects Turso metadata and private Backblaze B2 audio storage; it is not a separate website.

## Files

- `src/index.ts` — routes, authorization, sessions, uploads, streaming, deletion, admin operations, validation, CORS, and rate limits.
- `src/schema.ts` — idempotent schema inspection and missing-only migrations.
- `src/turso.ts` — Turso HTTP v2 client with typed positional SQL arguments.
- `src/b2.ts` — private B2 S3 API requests signed with AWS Signature V4. Audio response bodies are streamed rather than buffered by the Worker.
- `src/jwt.ts` — HS256 access, refresh, and song-specific stream tokens with issuer, audience, type, signature, and expiration checks.
- `src/passwords.ts` — scrypt for new accounts and read-only verification of common legacy scrypt, Argon2id/Argon2i, bcrypt, and PBKDF2 records.
- `wrangler.toml` — public, non-secret configuration for the existing `storage-cloudflare-worker` service.
- `tests/` — real SQL migration/auth/upload/stream/delete/admin tests using local SQLite and an in-memory private object store.

## Deploy the replacement Worker

Requires Node 22.13+ and a Cloudflare login already authorized in Wrangler. The existing Cloudflare secret values remain in Cloudflare; do not put them in `wrangler.toml`, `.env`, frontend code, or Git.

```sh
cd worker
npm ci
npm run check
npm test
npm run build       # dry-run bundle; does not deploy
npx wrangler secret list  # names only; never prints secret values
npx wrangler deploy
```

Required secret names:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `AUTH_SECRET` (at least 32 random bytes)

`B2_ENDPOINT`, `B2_BUCKET`, `B2_REGION`, and exact `CORS_ORIGINS` are public configuration in `wrangler.toml`. If the live service already has these as secrets, Cloudflare secrets take precedence over vars. Do not downgrade or print them to reconcile the configuration.

The frontend already points to `https://storage-cloudflare-worker.mr-hackerdon808.workers.dev`. Deploying this Worker changes the live API; test the dry-run and integration suite first. No deployment is performed by the website's GitHub Pages workflow.

## Database migration and existing users

On the first request in each Worker isolate, the backend:

1. Creates `users` and `songs` only if they do not exist.
2. Reads `PRAGMA table_info(users)` and `PRAGMA table_info(songs)`.
3. Adds only missing columns: `users.role`, `songs.b2_key`, `mime_type`, `file_size`, and `uploaded_by`.
4. Creates `auth_sessions` and `rate_limits` plus their indexes if absent.

It never drops a table, rewrites a password hash, resets a password, or automatically makes anyone an admin. New registrations always use the database role `user`, regardless of browser input.

New hashes use scrypt (`N=32768, r=8, p=1`, random 128-bit salt, 256-bit output). Existing scrypt, PHC Argon2id/Argon2i, bcrypt (`2a/2b/2y`), and common PBKDF2 records are verified in place and are **not** opportunistically rehashed.

An owner can inspect formats without printing hashes by running this only in a secure Turso owner shell:

```sql
SELECT id,
  CASE
    WHEN password_hash LIKE 'scrypt$%' THEN 'scrypt'
    WHEN password_hash LIKE '$scrypt$%' THEN 'scrypt-phc'
    WHEN password_hash LIKE '$argon2id$%' THEN 'argon2id'
    WHEN password_hash LIKE '$argon2i$%' THEN 'argon2i'
    WHEN password_hash LIKE '$2a$%' OR password_hash LIKE '$2b$%' OR password_hash LIKE '$2y$%' THEN 'bcrypt'
    WHEN password_hash LIKE 'pbkdf2%' THEN 'pbkdf2'
    ELSE 'review-required'
  END AS hash_format
FROM users;
```

If any existing account reports `review-required`, preserve the record and add its verified format before deploying a login migration. Do not reset the account or invent a password scheme.

## Promote the first administrator (owner-only)

There is deliberately no public/admin self-registration route. Register the owner account through the website, then run this manually in the Turso owner shell, replacing the email with the owner's real address:

```sql
UPDATE users SET role = 'admin' WHERE lower(email) = lower('owner@example.com');
SELECT id, username, email, role, created_at FROM users WHERE lower(email) = lower('owner@example.com');
```

Never include `password_hash` in administrative output. The Worker reads the current role from Turso for every protected request. The admin API also prevents self-role changes and removal of the last administrator.

## API contract

All JSON errors use `{ "success": false, "error": "…", "code": "…" }`; successes include `"success": true`.

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| GET | `/health` | Public | Checks Turso and a signed B2 bucket HEAD request |
| POST | `/auth/register` | Public, rate-limited | Validated registration, scrypt hash, duplicate email/username protection |
| POST | `/auth/login` | Public, rate-limited | Generic credential errors, signed access token, rotating refresh cookie |
| POST | `/auth/refresh` | Refresh cookie | Rotates the refresh token and returns a fresh access token/current DB role |
| POST | `/auth/logout` | Session | Revokes the session and clears the cookie |
| GET | `/auth/me` | Access token | Returns safe current-user fields only |
| GET | `/songs` | Public metadata; optional access token | Lists metadata; authenticated responses include song-specific stream tickets |
| POST | `/upload` | User/admin | Multipart `file`, plus `title`, `artist`, `album`, `duration`, optional `cover_url` |
| GET | `/stream/:id?ticket=…` | Active session | Streams private B2 audio and forwards one HTTP byte Range |
| DELETE | `/songs/:id` | Owner/admin | Deletes B2 first, then Turso; ownership is checked in the Worker |
| GET | `/admin/users` | Admin | Lists safe user fields only |
| POST | `/admin/users/:id/role` | Admin | JSON `{ "role": "user" | "admin" }`; role is checked from Turso |

Access tokens are returned as `accessToken` (with `token` as a compatibility alias) and `expiresAt` in milliseconds. They last 15 minutes and stay in frontend memory. Refresh tokens last 30 days in a `Secure; HttpOnly; SameSite=None; Path=/` cookie and rotate on every refresh. Refresh replay revokes the session. Logout and role/session checks also consult Turso.

The Worker also accepts existing external HS256 access tokens from the originally supplied login system when they contain `sub`, `role`, and `exp`. Their signature and expiry are verified, but the token's role is **never** used for authorization: the current role is loaded from Turso on every request. These older tokens have no rotating refresh cookie or server-side session to revoke, so they remain usable only until their signed `exp`; new logins use the rotating-session flow above. External tokens can obtain song-specific, expiring stream tickets without making `/stream` public.

Browser privacy settings that block all cross-site cookies can prevent refresh-cookie persistence between GitHub Pages and `workers.dev`; the user can sign in again. Do not weaken this by moving long-lived tokens into localStorage.

## Upload and deletion safety

- Formats: MP3, M4A, AAC/ADTS, WAV/RIFF, OGG, FLAC.
- Maximum upload: 100 MiB (suitable for Cloudflare's request limits); extension, MIME, magic bytes, and size are all checked.
- New object keys follow the supplied Worker's `songs/<uuid>.<extension>` layout and are never returned by the API. Existing `audio/<user>/…` objects remain playable through their stored `b2_key`.
- New `songs.added_at` values use the existing Unix-seconds convention; the frontend also accepts millisecond timestamps.
- `uploaded_by` always comes from the authenticated database user, never multipart/browser IDs.
- Upload order: B2 PUT → Turso INSERT. A failed insert triggers best-effort B2 compensation.
- Delete order: authorize → B2 DELETE → Turso DELETE. If B2 fails, metadata remains for a safe retry. If the final metadata delete fails, the API returns `METADATA_DELETE_FAILED` rather than claiming success.
- Stream responses forward `206`, `Content-Range`, `Content-Length`, `Accept-Ranges`, ETag, and `416` without exposing B2 credentials.

## Local verification

```sh
npm run check
npm test
npm run build
```

The tests execute real endpoint and SQL logic, including a real WAV multipart upload, B2-like Range responses, role/owner enforcement, token rotation/replay, legacy bcrypt login, scrypt and Argon2id verification, and missing-only migrations. They do not contact or mutate the live Turso database, B2 bucket, or deployed Worker.
