# Cloud music platform integration

This update modifies the existing Aether player; it does not add a demo site. Local IndexedDB audio, Android MediaStore tracks, playlists, favorites, metadata editing, backup/sync, EQ, visualizers, and synthesized sample tracks remain available.

## What changed and where

### Existing player integration

- `src/App.tsx` — restores sessions, merges cloud and local tracks, refreshes stream tickets, handles login/logout, cloud deletion, admin navigation, and upload completion.
- `src/services/cloud.ts` — public Worker origin, in-memory access token, refresh-cookie flow, API validation, upload XHR progress, and safe cloud-to-`Track` mapping. No secrets or long-lived browser tokens.
- `src/components/AuthDialog.tsx` — responsive sign-in/registration with email, strength, confirmation, and server error handling.
- `src/components/AccountMenu.tsx` and `AccountDialog.tsx` — account dropdown, profile, creation date, role, session controls, upload shortcut, and logout.
- `src/components/CloudUploadPanel.tsx` — tag/artwork extraction, editable title/artist/album, validation, progress, success/error states, and login-required state.
- `src/components/ImportDropzone.tsx` — existing local import preserved under **On this device**, with **Cloud library** added as a second destination.
- `src/components/AdminDashboard.tsx` — account/role administration and all-cloud-song moderation.
- `src/components/SongList.tsx`, `Sidebar.tsx`, `MobileBottomNav.tsx`, and `LibraryExperience.tsx` — cloud ownership indicators, permission-aware controls, admin navigation, and accurate local/cloud labels.
- `src/cloud.css` — responsive desktop/Android styling using the existing theme variables.
- `src/services/audioEngine.ts`, `src/services/aetherPlayer.ts`, and Android playback sources — authenticated HTTPS cloud playback, web CORS analysis, ExoPlayer streaming, and network wake mode. Arbitrary remote URLs from imported/backup metadata remain rejected.
- `src/types.ts` and `tests/` — cloud track metadata and regression coverage.

### Backend

The complete replacement Cloudflare Worker is in `worker/`. See [`worker/README.md`](worker/README.md) for its file map, deployment, schema inspection, API contract, legacy password support, security model, and owner-only first-admin SQL. No Worker deployment or live database mutation is implicit in a website build.

## User flows

1. **Register/sign in:** use the header account control. Registration cannot select a role. Login errors do not identify whether an email exists.
2. **Upload:** Import music → **Cloud library**, or account → **Upload to cloud library**. Local import remains the default from existing import buttons.
3. **Stream:** cloud rows show a cloud badge. Signed-in users receive song-specific stream tickets; both web audio and Android ExoPlayer use the Worker `/stream/:id` route with Range support.
4. **Delete:** users see delete controls only for their own cloud uploads; admins see them for every cloud track. The Worker independently verifies ownership/role.
5. **Profile:** account → Profile & account settings shows username, email, role, creation date, session expiry, refresh, and logout.
6. **Admin:** the first admin is promoted with owner-run Turso SQL. Admin navigation then appears on desktop and in the mobile More sheet.

## Deployment order

1. Review and test `worker/`; keep all existing Cloudflare secrets in Cloudflare.
2. Deploy the Worker with `cd worker && npx wrangler deploy` from an already authorized Wrangler session.
3. Promote the first administrator manually in Turso after registering the owner account.
4. Build/deploy the existing website through its normal GitHub Pages workflow. No secret is needed in Pages.
5. On the live GitHub Pages origin, test registration, reload persistence, login/logout, a small real audio upload, seeking near the middle/end, owner and non-owner deletion, and admin role changes.

The default public API origin is the supplied Worker URL. `VITE_CLOUD_API_URL` can override it with another HTTPS Worker origin; never put credentials in that variable.

## Verification in this checkout

- Root TypeScript check and all 54 frontend/player tests pass.
- Worker TypeScript check and all 6 Worker tests pass.
- Standard production build and GitHub Pages build pass.
- Wrangler deployment dry-run passes without secrets.
- Integration tests use local SQLite and simulated private object storage. They do not prove the live Turso schema, deployed Worker revision, real B2 credentials, third-party cookie policy in every browser, physical Android playback, or live upload until the owner deploys and performs the live checks above.
