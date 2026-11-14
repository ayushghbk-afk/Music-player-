# Aether Agent Skills

Curated Agent Skills for **`ayushghbk-afk/Music-player-` (Aether — Hi-Res Audio Player)**, structured using the portable Agent Skills standard (`skills/<skill-name>/SKILL.md` with YAML frontmatter, `references/`, `checklists/`, and `templates/`).

## Available skills

| Skill | Path | Primary use cases |
|---|---|---|
| **`aether-web-design`** | [`aether-web-design/SKILL.md`](aether-web-design/SKILL.md) | Product design, UX architecture, visual hierarchy, color/typography/motion systems, responsive layouts (`320`–`1600+` px), accessibility, and visual QA audits |
| **`aether-audio-dsp`** | [`aether-audio-dsp/SKILL.md`](aether-audio-dsp/SKILL.md) | Web Audio graph, RBJ biquad/Butterworth EQ, Simple & Extreme Studio modes, 3-band parametric rack, headroom/peak protection, RMS/VU meters, visualizers, song-aware spectral themes, and native DSP parity |
| **`aether-android-media3`** | [`aether-android-media3/SKILL.md`](aether-android-media3/SKILL.md) | Capacitor 8 Android app (`com.aether.audio.player`), Media3 `ExoPlayer` / `MediaSessionService`, Java PCM16 DSP, `LocalTrackServer` & serialized chunked imports, `MediaStore` discovery, and APK CI |
| **`aether-cloud-backend`** | [`aether-cloud-backend/SKILL.md`](aether-cloud-backend/SKILL.md) | Cloudflare Worker (`worker/` — Turso SQL, private Backblaze B2 SigV4 Range streaming, scrypt/legacy auth, rotating JWT cookies) and Express companion server (`server.ts` — SQLite snapshots & server-only AI proxy) |
| **`aether-library-lyrics-pwa`** | [`aether-library-lyrics-pwa/SKILL.md`](aether-library-lyrics-pwa/SKILL.md) | Offline `AetherAudioDB` IndexedDB storage, SHA-256 track import/deduplication, `.aetherjson` backup validation, LRC/SYLT synchronized lyrics reader, dedicated phone UI, and GitHub Pages PWA precaching |
| **`aether-testing-and-verification`** | [`aether-testing-and-verification/SKILL.md`](aether-testing-and-verification/SKILL.md) | Deterministic `node:test` suites (`tests/` & `worker/tests/`), dual-tsconfig verification, multi-target builds, `.e2b.app` live previews, and honest engineering/risk reporting |

## Discovery & installation across agent harnesses

- **Repository root (`AGENTS.md` & `skills/`):** `AGENTS.md` maps tasks in this repository directly to `skills/<skill-name>/SKILL.md`.
- **Claude Code & Codex / `.agents`-compatible agents:** `.claude/skills` and `.agents/skills` point directly to `skills/`, so every `SKILL.md` is discovered automatically without duplicating files.
- **SES / standalone skill loaders:** Copy any folder `skills/<skill-name>` into the directory scanned by SES (`.../skills/<skill-name>/SKILL.md`), or package an individual skill zip on demand:
  ```sh
  (cd skills && zip -r ../aether-audio-dsp.zip aether-audio-dsp)
  ```
- **`npx skills` CLI:**
  ```sh
  npx skills add ayushghbk-afk/Music-player-
  ```

## Skill structure & validation

Every skill in `skills/` follows progressive disclosure:
1. `SKILL.md` — concise activation metadata (`name`, `description`), operating principles, invariants, and step-by-step workflow.
2. `README.md` — human overview and smoke-test prompt.
3. `references/` — deep domain specifications, formulas, API contracts, and edge cases loaded on demand.
4. `checklists/` — pre-completion engineering and QA gates.
5. `templates/` *(optional)* — starter tokens or test patterns.

Skill integrity (frontmatter validity, directory naming, and broken-link checks across all `references/`, `checklists/`, and `templates/`) is continuously enforced by `tests/skills.test.ts` via `npm test`.
