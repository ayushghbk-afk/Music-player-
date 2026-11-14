# IndexedDB Storage, Audio Import & `.aetherjson` Backups

## `AetherAudioDB` (`src/services/db.ts`, version 1)

| Object Store | Key | Purpose |
|---|---|---|
| `tracks` | `keyPath: "id"` (indexes: `addedAt`, `title`, `artist`, `album`) | Track metadata without ephemeral `audioUrl` |
| `audioBlobs` | out-of-line `track.id` | Raw local `Blob` on Web (or fallback copy on Android if native transfer failed) |
| `playlists` | `keyPath: "id"` | User playlists (`Playlist`) |
| `kv` | string keys (`settings`, `eqSettings`, `favorites`, `customEqPresets`, `hiddenMediaTracks`, etc.) | Preferences and auxiliary state |

**Schema evolution warning:** If `DB_VERSION` is ever incremented, the `upgrade(db, oldVersion)` callback must preserve all four existing stores and existing user records without wiping data.

## Audio import & deduplication (`src/services/importTracks.ts`)

- Accepted extensions: `.flac`, `.wav`, `.mp3`, `.aac`, `.ogg`, `.oga`, `.m4a`, `.alac`.
- Upper file size guard: `1 GB` (`1024 * 1024 * 1024` bytes); note that `file.arrayBuffer()` for `SHA-256` allocates memory proportional to file size.
- Embedded cover art extraction: first picture `<= 1 MB` matching `image/(jpeg|png|webp|gif)` encoded as `data:<mime>;base64,...`.
- Repeat import / backup relink: `const previous = await getTrackMetadata(id)` preserves user-customized title, artist, album, lyrics, favorites, and `playCount` while refreshing `originalFileName` and storing the audio binary.

## `.aetherjson` backup validation (`src/services/backupSchema.ts`)

- `version`: literal `"1.0.0"`.
- Strips ASCII control characters (`\u0000-\u0008`, `\u000b`, `\u000c`, `\u000e-\u001f`) from all text fields.
- Bounds collection sizes (`trackMetadata <= 10000`, `playlists <= 1000`, `favorites <= 10000`, `lyrics <= 100000` chars).
- Rejects `NaN`/`Infinity` numbers and blocks external `http://` / `https://` `coverArt` URLs so importing a shared `.aetherjson` file cannot trigger tracking pixels or SSRF/mixed-content fetches.
