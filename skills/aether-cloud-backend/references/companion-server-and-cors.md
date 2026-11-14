# Companion Server (`server.ts`), Snapshots & AI Proxy

## Runtime & preview architecture

- Requires **Node 22.13+** because snapshot persistence uses built-in `node:sqlite` (`DatabaseSync`).
- In development (`npm run dev`), `server.ts` attaches Vite in `middlewareMode` sharing the same HTTP listener (`0.0.0.0`, default port `3000` or `PORT`) so Vite's default HMR port (`24678`) never collides with preview ports.
- Accepts same-origin requests, exact `CORS_ORIGINS` entries (default `https://localhost,capacitor://localhost`, plus `https://ayushghbk-afk.github.io` when deployed for GitHub Pages), and non-production `https://<host>.e2b.app` preview requests.

## Snapshot sync (`/api/backup/save`, `/api/backup/load/:code`)

- Validates incoming JSON via `validateBackup()` (`src/services/backupSchema.ts`) with a **5 MB** snapshot limit and a **10,000-row** admission cap in `DATA_DIR/aether.sqlite` (WAL mode, `0o700` directory permissions).
- Generates `AE-` + 32 uppercase crypto-random hex chars (`128` bits of entropy), expiring in **7 days** with hourly background cleanup.
- Sync codes are bearer tokens for metadata/playlists/settings/EQ only—audio blobs are never uploaded to `server.ts`.

## Sound Assistant proxy (`/api/ai`)

- Requires `LLM_API_KEY` (and optional `LLM_MODEL`, `LLM_BASE_URL` using `https:` or `127.0.0.1`) on the server.
- Returns HTTP `503` immediately when `LLM_API_KEY` is absent—never fabricate canned AI responses pretending an LLM ran.
- Enforces `2000`-char message cap, max `12` history turns, `10` requests/min/IP rate limit, and `30s` `AbortSignal.timeout`.
- System prompt explicitly instructs the model to treat track/library metadata as untrusted data, never claim to hear audio or mutate settings directly, and output JSON validated against `{ reply, suggestedPreset?, bands? }` (`bands` = 10 numbers in `-12..12`).
