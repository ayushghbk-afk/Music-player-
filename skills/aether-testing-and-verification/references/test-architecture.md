# Test Suite Architecture & Fixture Patterns

## Root test suite (`tests/*.test.ts` — run via `npm test`)

| File | Coverage focus |
|---|---|
| `tests/audio-engine.test.ts` | Out-of-order track load guards (`loadGeneration`), cancel/retry, autoplay block recovery, stale native event filtering |
| `tests/dsp.test.ts` | RBJ peaking/shelf unity & boost accuracy, `headroomDb` compensation, sample-rate finiteness (`8`–`192` kHz), `dbfs`, `eqSchema` defaults |
| `tests/studio-rack.test.ts` | 12 dB/oct Butterworth `-3 dB` corners, 3-band PEQ Q/headroom, `cloneEQ` deep isolation, `tapTempo`, `StudioRack` SSR accessibility |
| `tests/song-theme.test.ts` | Spectral centroid/flux extraction, gain invariance, silence reset, `SongThemeTracker` 8s dwell, luminance-safe `songAccent` |
| `tests/artwork-theme.test.ts` | Dominant artwork color extraction, near-black/white fallbacks, contrast lifting |
| `tests/lyrics.test.ts` | LRC multi-stamps, `[offset:]`, UTF-8 / UTF-16LE/BE BOM decoding, SYLT ms vs. MPEG-frame safety, unique sidecar matching |
| `tests/lyrics-reader.test.ts` | Bounded reader scroll centering, oversized line top-alignment, simultaneous translation highlighting, 5s manual-scroll pause |
| `tests/backup.test.ts` | `.aetherjson` Zod validation, control-char stripping, deduplication, rejection of external `http(s)` artwork URLs |
| `tests/cloud.test.ts` | `cloudSongToTrack` mapping, origin-checked `/stream/` URLs, session state handling |
| `tests/android-library.test.ts` | `MediaStore` reconciliation with `fake-indexeddb`, preserving user tag edits, `hiddenMediaTracks`, disconnected SD-card safety |
| `tests/native-import-queue.test.ts` | `SerialTaskQueue` ordering so chunked Android fallback writes never interleave even after errors |
| `tests/mobile-navigation.test.ts` | Mobile 5-tab bar, More sheet items, mini-player visibility rules |
| `tests/presentation.test.ts` | Bundled demo artwork assignment and resolution formatting |
| `tests/deployment.test.ts` | `assetUrl` base-path joining for `/` and `/Music-player-/` |
| `tests/wav.test.ts` | Synthesized 24-bit/96 kHz stereo PCM WAV encoding & `music-metadata` round-trip parsing |
| `tests/skills.test.ts` | Agent Skills frontmatter, naming, reference integrity, and `AGENTS.md` index validation |

## Worker test suite (`worker/tests/*.test.ts` — run via `npm run worker:test`)

- Uses `worker/tests/helpers.ts` to pair real Worker HTTP routing (`worker/src/index.ts`) with an in-memory `node:sqlite` Turso adapter and simulated private Backblaze B2 object store.
- `worker/tests/api.test.ts` exercises CORS preflight/rejection, registration, password strength, login enumeration resistance, token refresh/replay revocation, WAV multipart upload, HTTP `Range` (`206`/`416`) streaming, owner vs. admin deletion, and legacy external JWT compatibility.
- `worker/tests/passwords.test.ts` verifies scrypt, PHC scrypt, Argon2id/Argon2i, bcrypt, and PBKDF2 hash verification without mutating stored hashes.
