# Release & PR Readiness Checklist

Mark each item pass, fail, or N/A after actual verification.

## Automated checks
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm test` passes with 0 failures, including regression tests for new changes.
- [ ] `npm run worker:check`, `npm run worker:test`, and `npm run worker:build` pass when Worker or cloud code is present/touched.
- [ ] `npm run build:pages` succeeds without embedding server bundles or secrets.
- [ ] `npm run build` succeeds and leaves `dist/` + `dist/server.cjs` ready for `npm start`.

## Security & repo hygiene
- [ ] `git status` / `git diff` contains no `.env`, `data/*.sqlite`, `.jks`/`.keystore`, or large unintended binary artifacts.
- [ ] No secrets or tokens were placed in `VITE_*` variables, `wrangler.toml`, or markdown docs.
- [ ] `package-lock.json` was not broken by `npm audit fix --force`.

## Honest reporting
- [ ] Every reported test, build, and viewport check was genuinely executed in this session.
- [ ] Unverified items (e.g., local Gradle without Java, physical Android/iOS audio, live B2/Turso/LLM endpoints) are explicitly noted.
