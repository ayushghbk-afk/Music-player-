# Backend & Cloud Security Checklist

Mark each item pass, fail, or N/A after actual verification.

## Secrets & token hygiene
- [ ] Zero secrets (`TURSO_*`, `B2_*`, `AUTH_SECRET`, `LLM_API_KEY`) appear in `src/`, `VITE_*`, `wrangler.toml`, or Git.
- [ ] Access tokens stay in JS memory only (not `localStorage` / `sessionStorage`).
- [ ] Refresh cookies retain `Secure; HttpOnly; SameSite=None; Path=/` and rotate with replay revocation.
- [ ] `password_hash` and private `b2_key` fields are never serialized in API responses.

## Database & storage integrity
- [ ] Turso schema setup uses missing-only `ALTER TABLE` migrations and never drops tables or rehashes legacy passwords.
- [ ] Every SQL query uses parameterized bindings.
- [ ] Protected routes check `role` and track ownership from Turso on every request.
- [ ] Admin routes prevent self-role changes and deleting/demoting the last admin.
- [ ] Uploads validate extension, MIME, magic bytes, and `<= 100 MiB` size before B2 `PUT`.
- [ ] Deletions remove B2 object *before* Turso metadata row.
- [ ] `/stream/:id` streams B2 responses unbuffered and supports HTTP `Range` (`206` / `416`).

## Companion server & CORS
- [ ] `CORS_ORIGINS` uses exact origins without wildcard `*` reflection.
- [ ] `/api/ai` returns `503` without `LLM_API_KEY` and validates model JSON output with Zod.
- [ ] `/api/backup/save` enforces the 5 MB payload limit and `validateBackup` schema.

## Verification
- [ ] `npm run worker:check`, `npm run worker:test`, and `npm run worker:build` pass.
- [ ] `npm run lint` and `npm test` (`cloud.test.ts`, `backup.test.ts`) pass.
- [ ] No unauthorized `wrangler deploy` or live DB mutation was executed.
