package com.aether.audio.player.playback;

import android.content.Context;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Persistent, app-private storage for imported audio files.
 *
 * Files live under {@code filesDir/aether-tracks} (NOT cacheDir) so Android is
 * not allowed to silently purge them under storage pressure. Importing a track
 * is a one-time cost: every later playback streams straight from disk into
 * ExoPlayer without any JavaScript involvement.
 */
public final class TrackStore {

    private static final String DIR_NAME = "aether-tracks";
    private static final String LEGACY_DIR_NAME = "aether-tracks"; // previously under cacheDir
    private static final String TEMP_SUFFIX = ".tmp";

    private final File tracksDir;

    public TrackStore(Context context) {
        this.tracksDir = new File(context.getFilesDir(), DIR_NAME);
        if (!tracksDir.exists() && !tracksDir.mkdirs()) {
            // Best effort; writes will fail loudly through the plugin if the
            // directory genuinely cannot be created.
        }
        migrateFromCacheDir(context);
    }

    /** One-time migration: move tracks written by older builds into filesDir. */
    private void migrateFromCacheDir(Context context) {
        try {
            File legacyDir = new File(context.getCacheDir(), LEGACY_DIR_NAME);
            File[] legacy = legacyDir.listFiles();
            if (legacy == null) return;
            for (File file : legacy) {
                if (!file.isFile()) continue;
                File target = new File(tracksDir, file.getName());
                if (target.exists()) {
                    // Persistent copy already present; drop the cache duplicate.
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                } else if (!file.renameTo(target)) {
                    copyThenDelete(file, target);
                }
            }
            //noinspection ResultOfMethodCallIgnored
            legacyDir.delete();
        } catch (Exception ignored) {
            // Migration is best-effort; the legacy cache copy remains usable.
        }
    }

    private static void copyThenDelete(File source, File target) {
        try (FileInputStream in = new FileInputStream(source);
             FileOutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) > 0) {
                out.write(buffer, 0, read);
            }
            //noinspection ResultOfMethodCallIgnored
            source.delete();
        } catch (IOException ignored) {
            //noinspection ResultOfMethodCallIgnored
            target.delete();
        }
    }

    public File getTracksDir() {
        return tracksDir;
    }

    public boolean hasTrack(String trackId) {
        return findTrackFile(trackId) != null;
    }

    /**
     * Returns the stored file for a track id. The id alone is enough because
     * track ids are unique per track; any supported extension matches.
     */
    public File findTrackFile(String trackId) {
        String prefix = sanitize(trackId) + ".";
        File[] files = tracksDir.listFiles();
        if (files == null) return null;
        File fallback = null;
        for (File file : files) {
            String name = file.getName();
            if (!file.isFile() || name.endsWith(TEMP_SUFFIX)) continue;
            if (name.equals(prefix + "bin") && fallback == null) {
                // Keep the extensionless fallback as a last resort.
                fallback = file;
                continue;
            }
            if (name.startsWith(prefix)) {
                return file;
            }
        }
        return fallback;
    }

    /** Opens a temporary file for a streamed import. Call {@link #finishWrite} or {@link #abortWrite}. */
    public TempWrite beginWrite(String trackId, String extension) throws IOException {
        String base = sanitize(trackId);
        String ext = normalizeExtension(extension);
        File target = new File(tracksDir, base + ext);
        // Invalidate any previous version of this track before rewriting it.
        //noinspection ResultOfMethodCallIgnored
        target.delete();
        // Unique temp name so a concurrent server import and plugin fallback
        // import for the same track never collide on one temp file.
        File temp = new File(tracksDir, base + ext + TEMP_SUFFIX + "-" + System.nanoTime());
        return new TempWrite(target, temp, new FileOutputStream(temp));
    }

    private static String normalizeExtension(String extension) {
        String ext = extension == null ? "" : extension.trim();
        if (ext.isEmpty() || "bin".equals(ext)) return ".bin";
        return ext.startsWith(".") ? ext : "." + ext;
    }

    public void finishWrite(TempWrite write) throws IOException {
        write.out.flush();
        write.out.close();
        if (!write.temp.renameTo(write.target)) {
            throw new IOException("Unable to finalize imported track");
        }
    }

    public void abortWrite(TempWrite write) {
        try {
            write.out.close();
        } catch (IOException ignored) {
        }
        //noinspection ResultOfMethodCallIgnored
        write.temp.delete();
    }

    public boolean deleteTrack(String trackId) {
        File file = findTrackFile(trackId);
        boolean deleted = file != null && file.delete();
        // Also drop any half-written temp files for this id.
        File[] files = tracksDir.listFiles();
        if (files != null) {
            String prefix = sanitize(trackId) + ".";
            for (File candidate : files) {
                if (candidate.getName().startsWith(prefix)) {
                    //noinspection ResultOfMethodCallIgnored
                    candidate.delete();
                }
            }
        }
        return deleted;
    }

    public int clearAll() {
        File[] files = tracksDir.listFiles();
        int removed = 0;
        if (files != null) {
            for (File file : files) {
                if (file.isFile() && file.delete()) {
                    removed++;
                }
            }
        }
        return removed;
    }

    static String sanitize(String value) {
        return value == null ? "unknown" : value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    static final class TempWrite {
        final File target;
        final File temp;
        final OutputStream out;

        TempWrite(File target, File temp, FileOutputStream out) {
            this.target = target;
            this.temp = temp;
            this.out = out;
        }
    }
}
