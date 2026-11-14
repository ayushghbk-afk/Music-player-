# Full-Stack Verification Matrix

Run commands from `/home/user/Music-player-` (requires Node `>= 22.13.0`).

## 1. Static type checking

```sh
npm run lint           # Root TypeScript check (src, server.ts, tests, scripts)
npm run worker:check   # Worker TypeScript check (worker/src, worker/tests)
```

*Note:* If `worker/node_modules` is not yet installed, run `npm --prefix worker ci` once first.

## 2. Automated unit & integration suites

```sh
npm test               # Runs tsx --test tests/*.test.ts
npm run worker:test    # Runs tsx --test worker/tests/*.test.ts
```

## 3. Build targets

```sh
npm run worker:build   # Wrangler dry-run bundle check (no secrets or live deploy)
npm run build:pages    # Static GitHub Pages bundle at /Music-player-/ + PWA sw.js + .nojekyll
npm run build:android  # Android icons/splash + Vite build + PWA sw.js + npx cap sync android
npm run build          # Production Vite client + PWA sw.js + dist/server.cjs (run LAST if testing npm start)
```

## 4. Live server & preview checks

- **Development preview:** Start `npm run dev` (or `PORT=3000 npm run dev`) with `start_process`, wait for listening port `3000`, and verify `GET /api/health` returns `{"status":"ok","aiConfigured":false}` and `/` serves HTML cleanly with `.e2b.app` host headers.
- **Native Android (only when Java 21 + Android SDK 36 exist):**
  ```sh
  cd android && ./gradlew testDebugUnitTest assembleDebug lintDebug --no-daemon
  ```
  When `java` is absent in the sandbox, state explicitly that Gradle compilation and JUnit execution run in `.github/workflows/android-build.yml` rather than locally.
