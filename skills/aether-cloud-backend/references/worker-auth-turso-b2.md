# Cloudflare Worker: Auth, Turso SQL & Backblaze B2

## Endpoint & authorization summary (`worker/src/index.ts`)

| Endpoint | Auth | Critical invariants |
|---|---|---|
| `GET /health` | Public | Verifies Turso connectivity + signed B2 `HEAD` bucket check; leaks no secrets |
| `POST /auth/register` | Public (rate-limited) | Forces `role = 'user'`; rejects weak/mismatched passwords; scrypt hash; never returns `password_hash` |
| `POST /auth/login` | Public (rate-limited) | Case-insensitive email lookup; identical error message for bad email vs. bad password; issues 15m access token + 30d `HttpOnly` refresh cookie |
| `POST /auth/refresh` | `aether_refresh` cookie | Rotates refresh token hash in `auth_sessions`; replay of a prior token revokes the session |
| `POST /auth/logout` | Session / cookie | Marks session revoked in Turso and clears cookie |
| `GET /auth/me` | Bearer token | Reloads user & current `role` from Turso |
| `GET /songs` | Public or Bearer | Public metadata list; when authenticated, attaches expiring song-specific `/stream/:id?ticket=...` URLs; never exposes `b2_key` |
| `POST /upload` | Authenticated user/admin | Multipart `file` (`<= 100 MiB`, magic-byte verified MP3/M4A/AAC/WAV/OGG/FLAC); `uploaded_by` comes strictly from authenticated DB user; B2 `PUT` -> Turso `INSERT`; `added_at` in Unix seconds |
| `GET /stream/:id?ticket=...` | Valid stream ticket | Verifies song-scoped ticket + active session; forwards single `Range` header to private B2 via AWS SigV4; streams `200`/`206`/`416` body unbuffered |
| `DELETE /songs/:id` | Owner or DB-verified admin | Checks Turso ownership/role -> B2 `DELETE` -> Turso `DELETE` |
| `GET /admin/users` | DB-verified admin | Safe fields only (`id, username, email, role, created_at`) |
| `POST /admin/users/:id/role` | DB-verified admin | Blocks self-demotion and removing the last remaining admin |

## Frontend integration (`src/services/cloud.ts`)

- Default Worker origin: `https://storage-cloudflare-worker.mr-hackerdon808.workers.dev` (overridable via `VITE_CLOUD_API_URL`, which must be `https:` with no embedded credentials).
- Cloud tracks map to `id: "cloud_" + song.id` with `storage: "cloud"` and `cloudId: song.id`.
- `songFrom()` verifies that any `stream_url` shares `API_ORIGIN` and starts with `/stream/`, preventing open-redirect or rogue remote-audio injection.
