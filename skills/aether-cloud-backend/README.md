# Aether Cloud Platform & Companion Backend Skill

Security and backend engineering playbook for Aether's Cloudflare Worker (`worker/` — Turso SQL + private Backblaze B2 + rotating JWT auth) and Express companion server (`server.ts` — `node:sqlite` sync snapshots + server-only LLM proxy).

## Contents

- `SKILL.md` — security invariants, data-mutation ordering, and dual-project workflow.
- `references/worker-auth-turso-b2.md` — Worker endpoints, JWT/cookie lifecycle, legacy password support, and B2 SigV4 Range streaming.
- `references/companion-server-and-cors.md` — `server.ts` snapshot storage, `/api/ai` safety boundaries, CORS allowlists, and Arena `.e2b.app` preview setup.
- `checklists/backend-security-checklist.md` — auth, SQL, object storage, secret hygiene, and test checklist.

## Suggested smoke test

> Use the `aether-cloud-backend` skill. Review `worker/src/index.ts`, `worker/src/passwords.ts`, and `src/services/cloud.ts` to verify authorization, refresh-token replay revocation, and B2 delete ordering, then run `npm run worker:check`, `npm run worker:test`, `npm run worker:build`, and `npm test`.
