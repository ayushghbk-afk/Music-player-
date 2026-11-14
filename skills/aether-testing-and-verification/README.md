# Aether Testing, Verification & Release QA Skill

Playbook for writing deterministic `node:test` suites, running root and Cloudflare Worker checks, validating all Vite/PWA/Express/Pages/Android build targets, testing live previews, and reporting verification honestly.

## Contents

- `SKILL.md` — testing philosophy, build-order gotchas, preview rules, and verification workflow.
- `references/test-architecture.md` — map of `tests/*.test.ts` and `worker/tests/*.test.ts` plus mocking/fixture conventions.
- `references/verification-matrix.md` — exact commands for linting, unit tests, builds, and preview health checks.
- `templates/node-test-template.md` — idiomatic `node:test` + `assert/strict` starter for Aether modules.
- `checklists/release-readiness.md` — final pre-handoff verification checklist.

## Suggested smoke test

> Use the `aether-testing-and-verification` skill. Run the full root and Worker verification matrix (`lint`, `test`, `worker:check`, `worker:test`, `worker:build`, `build:pages`, `build`), verify there are zero regressions, and report exact test counts and environment boundaries.
