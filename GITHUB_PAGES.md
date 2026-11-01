# Publish Aether on GitHub Pages

Expected project URL: **https://ayushghbk-afk.github.io/Music-player-/** (not live until the deployment succeeds).

## One-time repository setup

1. Open [Settings → Pages](https://github.com/ayushghbk-afk/Music-player-/settings/pages).
2. Set **Build and deployment → Source → GitHub Actions**.
3. Keep **Settings → Environments → github-pages** restricted to `main`. Keep any required reviewer approvals; approve the deployment when prompted.
4. Merge the deployment fixes into `main`. The workflow automatically builds and publishes on pushes to `main`. Pull requests build and test only. For a manual retry, select **Actions → Deploy website to GitHub Pages → Run workflow → main**.

The Pages site is now configured for GitHub Actions. The session’s GitHub app cannot change Pages settings or environment protection rules (HTTP 403), so publishing uses the existing allowed `main` branch instead of weakening those rules. Do not supply tokens in chat.

## Build and verify locally

```sh
npm ci
npm run lint
npm test
npm run build:pages
```

The static output is `dist/`; it contains no Express server bundle, SQLite database, provider keys, or signing keys. The default base is `/Music-player-/`. For another project, set `AETHER_BASE_PATH=/your-repository/` for both Vite and the PWA finalizer. Deploy the whole `dist` folder, including `.nojekyll`, `manifest.json`, `sw.js`, `art`, and `assets`.

The app's asset paths, icons, web manifest, media-session artwork and service worker all follow the project base. The service worker precaches the app's JS/CSS and five bundled covers, uses a scope-specific cache name and avoids intercepting API requests or other GitHub Pages projects.

## What works without a backend

Local-file import/playback, generated demonstrations, library/search/favorites, albums/playlists, EQ, settings and local `.aetherjson` export/restore run entirely in the browser. Audio and IndexedDB libraries are specific to the website origin; an existing localhost library is not automatically copied to GitHub Pages. Import your music on the new origin, and retain source-file backups.

GitHub Pages cannot execute Express, SQLite, or an LLM proxy. **AI and server snapshot sync require a separately hosted HTTPS companion server.** The static build gives a readable configuration message rather than calling a nonexistent GitHub Pages API.

To connect one:

1. Deploy `server.ts` separately using the README's server setup, with persistent storage and server-only LLM keys.
2. Include `https://ayushghbk-afk.github.io` in that server's exact `CORS_ORIGINS` allowlist (no repository path in an Origin).
3. In Aether → **Backup & sync → Companion server settings**, save its HTTPS origin. The same setting works for the Android app, whose origin is `https://localhost`.

No provider or signing secret belongs in `VITE_*` variables or the Pages artifact. `VITE_API_BASE_URL`, if used, is only a public HTTPS endpoint.
