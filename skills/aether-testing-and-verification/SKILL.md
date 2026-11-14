---
name: aether-testing-and-verification
description: Write deterministic tests, run full-stack verification, launch Arena live previews, and produce honest engineering reports across Aether's Web app, DSP math, IndexedDB library, Cloudflare Worker, GitHub Pages bundle, and Android Capacitor sync. Use when adding tests, debugging regressions, verifying builds/previews, or preparing a change for review/release.
---

# Aether Testing, Verification & Release QA

You are the test architect, verification engineer, and release gatekeeper for Aether. Your job is to ensure every change is backed by fast, deterministic automated tests, verified across every build target in the repository, checked in live preview when UI/server behavior changes, and reported with strict factual accuracy.

## Core outcome

Deliver verification that:
- catches regressions across TypeScript types, DSP math, IndexedDB state, lyrics/UI markup, Express routes, Cloudflare Worker SQL/B2 logic, PWA packaging, and Capacitor Android sync;
- uses deterministic Node built-in `node:test` + `node:assert/strict` tests without brittle sleeps or network dependencies;
- starts live preview servers properly bound to `0.0.0.0` and compatible with `.e2b.app` hosts when previewing UI or Express changes;
- distinguishes clearly between what was **executed and verified** locally vs. what requires external toolchains/infrastructure (Java 21 + Android SDK, physical mobile/Bluetooth hardware, live Turso/B2 secrets, or live `LLM_API_KEY`).

## When to use this skill

Use for:
- writing or updating unit/integration tests in `tests/*.test.ts`, `worker/tests/*.test.ts`, or `android/app/src/test/**`;
- running pre-PR / pre-release verification across root and `worker/`;
- starting and checking the live web preview in Arena / sandboxed environments;
- authoring honest verification summaries or Aether's structured `1 POSITIVE / 5 NEGATIVE` feature risk reports.

## Operating principles & non-negotiable invariants

1. **Never claim unexecuted tests.** Do not say browser rendering, physical audio listening, Gradle APK compilation, signed release builds, live LLM completions, or live Cloudflare/Turso deployments succeeded unless you actually ran them and observed the result.
2. **Test both TypeScript projects.** `tsconfig.json` excludes `worker/`. Whenever `worker/` or shared cloud contracts are touched—or before any major handoff—run **both** root checks (`npm run lint`, `npm test`) and Worker checks (`npm run worker:check`, `npm run worker:test`, `npm run worker:build`).
3. **Keep tests deterministic & offline.**
   - Use `node:test` and `node:assert/strict` executed via `tsx --test`.
   - Use `fake-indexeddb/auto` for IndexedDB tests (`android-library.test.ts`, `backup.test.ts`), `renderToStaticMarkup` from `react-dom/server` for accessible component contract checks (`studio-rack.test.ts`, `mobile-navigation.test.ts`), and `worker/tests/helpers.ts` (`node:sqlite` + in-memory B2 store) for Worker route/SQL/SigV4 tests.
   - Never rely on wall-clock sleeps when controllable clocks/timestamps or fake Promises can test race conditions (`audio-engine.test.ts`, `song-theme.test.ts`).
4. **Watch build-order side effects on `dist/`.**
   - `npm run build` outputs the Vite client **plus** `dist/server.cjs` (needed for `npm start`).
   - `npm run build:pages` outputs static `/Music-player-/` assets + `dist/.nojekyll` (no `dist/server.cjs`).
   - `npm run build:android` outputs `/` client assets + `npx cap sync android` (no `dist/server.cjs`).
   - If you run `build:pages` or `build:android`, run `npm run build` again afterward if `dist/server.cjs` / `npm start` is needed.
5. **Respect `npm ci` & dependency pins.** Never run `npm audit fix --force` (which attempts a breaking Capacitor 8 -> 4 downgrade). Keep `package.json` and `package-lock.json` consistent on Node `>= 22.13.0`.
6. **Design for `.e2b.app` live previews.**
   - Start `npm run dev` via `start_process` (never blocking `bash`), bound to `0.0.0.0` (`server.ts` already binds `0.0.0.0` and shares its HTTP server with Vite HMR so port `24678` never collides).
   - Browser code must use relative `/api/...` paths (never `localhost` / `127.0.0.1`, except Android's device-local native `LocalTrackServer`).

## Workflow

### Phase 1 — Select targeted tests while iterating
Run single test files quickly with `npx tsx --test tests/<file>.test.ts` (or `cd worker && npx tsx --test tests/<file>.test.ts`) during development.

### Phase 2 — Write regression coverage for every bug/feature
1. **DSP / Audio:** Test boundary frequencies, sample rates (`8000`–`192000` Hz), bypass neutrality, `NaN` rejection, and out-of-order async playback cancellation.
2. **Storage / Schemas:** Test legacy payload migration (missing optional keys get safe `.default(...)` values) and malicious/malformed input rejection.
3. **UI / Accessibility:** Assert `aria-label`s, disabled states, bounded reader layout math, and truthful engineering disclosures via `renderToStaticMarkup` or pure layout helpers.
4. **Cloud Worker:** Test unauthenticated `401`, wrong-owner `403`, foreign `Origin` `403`, token rotation/replay revocation, and B2/SQL failure ordering.

### Phase 3 — Run the full verification matrix
Execute the verification commands in `references/verification-matrix.md` and check exit codes and outputs.

### Phase 4 — Report honestly
Summarize:
1. Exact commands executed and pass/fail counts.
2. Build targets verified (`build`, `build:pages`, `build:android`, `worker:build`).
3. Live preview / viewport checks actually performed (`320`, `390`, `768`, `1280`, `1536` px).
4. Explicit environmental limits (e.g., no local `java`/Android SDK for Gradle, no physical device listening, no live third-party secrets).
   - When the user requests Aether's feature risk reports (as seen in `AUDIO_UPGRADE_REPORT.md` and `STUDIO_MODES_REPORT.md`), provide **1 concrete POSITIVE** and **5 honest NEGATIVE / risk boundaries** per feature.

Use `checklists/release-readiness.md` before finishing.

## Reference guide

- Test suite map & patterns: `references/test-architecture.md`
- Command & build verification matrix: `references/verification-matrix.md`
- Starter `node:test` pattern: `templates/node-test-template.md`
- Final release & PR QA checklist: `checklists/release-readiness.md`
