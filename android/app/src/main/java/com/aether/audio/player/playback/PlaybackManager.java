package com.aether.audio.player.playback;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;

/**
 * Owns the single ExoPlayer instance shared by the WebView bridge and the
 * MediaSessionService.
 *
 * Lifecycle contract (important for background playback):
 * every playback command is deferred until the foreground service has actually
 * finished onCreate(), so the MediaSession exists before ExoPlayer starts.
 * The previous behavior (prepare -> play -> startService) raced ExoPlayer
 * against the service becoming the foreground lifecycle owner.
 */
public final class PlaybackManager {

    public interface Listener {
        void onIsPlayingChanged(boolean isPlaying);
        void onEnded();
        void onPosition(long positionMs, long durationMs);
        void onSkipToNext();
        void onSkipToPrevious();
        void onError(String message);
    }

    private static final long SERVICE_START_TIMEOUT_MS = 2000;
    private static final long POSITION_PERSIST_INTERVAL_MS = 5000;

    private static volatile PlaybackManager instance;

    private final Context appContext;
    private final ExoPlayer exoPlayer;
    private final Player player;
    private final TrackStore trackStore;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<Listener> listeners = new ArrayList<>();
    private final SharedPreferences prefs;

    private boolean noisyRegistered;
    private TrackStore.TempWrite activeWrite;
    private volatile boolean serviceReady = false;
    private final List<Runnable> pendingCommands = new ArrayList<>();
    private final Runnable serviceTimeout = new Runnable() {
        @Override
        public void run() {
            drainPendingCommands();
        }
    };
    private long lastPersistAt = 0;

    private final Runnable positionTick = new Runnable() {
        @Override
        public void run() {
            notifyPosition();
            persistPositionThrottled();
            mainHandler.postDelayed(this, 500);
        }
    };

    private final BroadcastReceiver becomingNoisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                player.pause();
            }
        }
    };

    private PlaybackManager(Context context) {
        this.appContext = context.getApplicationContext();
        this.prefs = appContext.getSharedPreferences("aether_playback", Context.MODE_PRIVATE);
        this.trackStore = new TrackStore(appContext);

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        // The player MUST be owned by the main looper: Capacitor plugin calls
        // arrive on a bridge thread and the service/MediaSession run on main.
        // ExoPlayer enforces single-thread access (verifyApplicationThread),
        // so everything is funneled to main — see get() and the plugin.
        exoPlayer = new ExoPlayer.Builder(appContext)
                .setLooper(Looper.getMainLooper())
                .build();
        exoPlayer.setAudioAttributes(attrs, true);
        exoPlayer.setHandleAudioBecomingNoisy(true);
        // NETWORK is a superset of LOCAL: holds a partial wake lock during
        // playback (required for local files) plus a Wi-Fi lock for http(s)
        // streams. The screen must NOT be kept awake for audio playback.
        exoPlayer.setWakeMode(C.WAKE_MODE_NETWORK);
        player = new ForwardingPlayer(exoPlayer) {
            @Override
            public boolean isCommandAvailable(int command) {
                if (command == COMMAND_SEEK_TO_NEXT
                        || command == COMMAND_SEEK_TO_NEXT_MEDIA_ITEM
                        || command == COMMAND_SEEK_TO_PREVIOUS
                        || command == COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
                    return true;
                }
                return super.isCommandAvailable(command);
            }

            @Override
            public void seekToNext() {
                notifySkipNext();
            }

            @Override
            public void seekToNextMediaItem() {
                notifySkipNext();
            }

            @Override
            public void seekToPrevious() {
                notifySkipPrevious();
            }

            @Override
            public void seekToPreviousMediaItem() {
                notifySkipPrevious();
            }
        };
        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) {
                    registerNoisy();
                    mainHandler.removeCallbacks(positionTick);
                    mainHandler.post(positionTick);
                } else {
                    unregisterNoisy();
                    persistPosition();
                }
                for (Listener listener : copyListeners()) {
                    listener.onIsPlayingChanged(isPlaying);
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    persistPosition(0);
                    for (Listener listener : copyListeners()) {
                        listener.onEnded();
                    }
                }
            }

            @Override
            public void onPlayerError(androidx.media3.common.PlaybackException error) {
                for (Listener listener : copyListeners()) {
                    listener.onError(error.getMessage() == null ? "playback error" : error.getMessage());
                }
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
                    for (Listener listener : copyListeners()) {
                        listener.onSkipToNext();
                    }
                }
            }
        });
    }

    private static final Object CREATE_LOCK = new Object();

    /**
     * Returns the singleton, guaranteeing it was constructed on the main
     * thread (the player's application looper). Safe to call from the
     * Capacitor bridge thread or from the service.
     */
    public static PlaybackManager get(Context context) {
        if (instance != null) return instance;

        if (Looper.myLooper() == Looper.getMainLooper()) {
            synchronized (CREATE_LOCK) {
                if (instance == null) {
                    instance = new PlaybackManager(context.getApplicationContext());
                }
            }
            return instance;
        }

        // Called off-main (e.g. Capacitor bridge thread): construct on main
        // and wait. No monitor is held while waiting, so main runs freely.
        final CountDownLatch latch = new CountDownLatch(1);
        new Handler(Looper.getMainLooper()).post(() -> {
            get(context);
            latch.countDown();
        });
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while initializing PlaybackManager", e);
        }
        synchronized (CREATE_LOCK) {
            if (instance == null) {
                throw new IllegalStateException("PlaybackManager failed to initialize");
            }
            return instance;
        }
    }

    public Player getPlayer() {
        return player;
    }

    public TrackStore getTrackStore() {
        return trackStore;
    }

    public void addListener(Listener listener) {
        synchronized (listeners) {
            listeners.add(listener);
        }
    }

    public void removeListener(Listener listener) {
        synchronized (listeners) {
            listeners.remove(listener);
        }
    }

    // ---------------------------------------------------------------------
    // Service lifecycle
    // ---------------------------------------------------------------------

    /** Called by {@link MusicPlayerService#onCreate()} once its session exists. */
    public void onServiceReady() {
        if (serviceReady) return;
        serviceReady = true;
        mainHandler.removeCallbacks(serviceTimeout);
        drainPendingCommands();
    }

    /** Called by {@link MusicPlayerService#onDestroy()} so the next play re-starts the service. */
    public void onServiceDestroyed() {
        serviceReady = false;
    }

    /**
     * Runs a playback command only after the foreground service is up:
     * service -> media session -> setMediaItem -> prepare -> play.
     * If the service is already alive the command runs immediately; if the
     * service cannot be started we still run the command (better one attempt
     * with no foreground service than silence) after a short timeout.
     */
    private void runWhenServiceReady(final Runnable command) {
        mainHandler.post(() -> {
            if (serviceReady) {
                command.run();
                return;
            }
            synchronized (pendingCommands) {
                pendingCommands.add(command);
            }
            try {
                Intent intent = new Intent(appContext, MusicPlayerService.class);
                appContext.startForegroundService(intent);
            } catch (IllegalStateException | SecurityException e) {
                // Foreground-service start not allowed from the current app
                // state (e.g. Android 12+ background restrictions). Drain now.
                drainPendingCommands();
                return;
            }
            mainHandler.postDelayed(serviceTimeout, SERVICE_START_TIMEOUT_MS);
        });
    }

    private void drainPendingCommands() {
        List<Runnable> toRun;
        synchronized (pendingCommands) {
            if (pendingCommands.isEmpty()) return;
            toRun = new ArrayList<>(pendingCommands);
            pendingCommands.clear();
        }
        for (Runnable command : toRun) {
            mainHandler.post(command);
        }
    }

    // ---------------------------------------------------------------------
    // Playback commands
    // ---------------------------------------------------------------------

    public void playFile(File file, String title, String artist, String album, long startPositionMs) {
        playUri(Uri.fromFile(file), title, artist, album, startPositionMs);
    }

    public void playUri(final Uri uri, final String title, final String artist, final String album, final long startPositionMs) {
        runWhenServiceReady(() -> {
            MediaMetadata metadata = new MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album)
                    .build();
            MediaItem item = new MediaItem.Builder()
                    .setUri(uri)
                    .setMediaMetadata(metadata)
                    .build();
            player.setMediaItem(item, startPositionMs > 0 ? startPositionMs : 0);
            player.prepare();
            player.play();
        });
    }

    public void play() {
        runWhenServiceReady(player::play);
    }

    public void pause() {
        player.pause();
        persistPosition();
    }

    public void seek(long positionMs) {
        player.seekTo(Math.max(0, positionMs));
        notifyPosition();
    }

    public void setVolume(float volume) {
        player.setVolume(Math.max(0f, Math.min(1f, volume)));
    }

    public void setPlaybackRate(float rate) {
        player.setPlaybackSpeed(Math.max(0.5f, Math.min(3f, rate)));
    }

    public boolean isPlaying() {
        return player.isPlaying();
    }

    public long getPositionMs() {
        return Math.max(0, player.getCurrentPosition());
    }

    public long getDurationMs() {
        long duration = player.getDuration();
        return duration == C.TIME_UNSET ? 0 : Math.max(0, duration);
    }

    public void notifySkipNext() {
        for (Listener listener : copyListeners()) {
            listener.onSkipToNext();
        }
    }

    public void notifySkipPrevious() {
        for (Listener listener : copyListeners()) {
            listener.onSkipToPrevious();
        }
    }

    public long lastSavedPositionMs() {
        return prefs.getLong("position_ms", 0);
    }

    // ---------------------------------------------------------------------
    // Chunked (base64) import fallback — used only when the loopback server
    // is unavailable. The primary import path streams via LocalTrackServer.
    // ---------------------------------------------------------------------

    public void beginCache(String trackId, String extension) throws Exception {
        closeCache();
        try {
            activeWrite = trackStore.beginWrite(trackId, extension);
        } catch (Exception error) {
            throw new Exception("Unable to create track file: " + error.getMessage());
        }
    }

    public void appendCache(byte[] chunk) throws Exception {
        if (activeWrite == null) {
            throw new Exception("Cache write has not been started");
        }
        try {
            activeWrite.out.write(chunk);
        } catch (Exception error) {
            trackStore.abortWrite(activeWrite);
            activeWrite = null;
            throw new Exception("Cache write failed: " + error.getMessage());
        }
    }

    /** Finalizes a chunked import WITHOUT starting playback. */
    public File commitCache() throws Exception {
        if (activeWrite == null) {
            throw new Exception("No track import in progress");
        }
        TrackStore.TempWrite write = activeWrite;
        activeWrite = null;
        try {
            trackStore.finishWrite(write);
        } catch (Exception error) {
            trackStore.abortWrite(write);
            throw new Exception("Unable to finalize track: " + error.getMessage());
        }
        if (!write.target.exists()) {
            throw new Exception("No stored audio file");
        }
        return write.target;
    }

    /** Legacy bridge method: finalize the chunked import and immediately play it. */
    public File endCache() throws Exception {
        return commitCache();
    }

    public File findStoredTrack(String trackId) {
        return trackStore.findTrackFile(trackId);
    }

    public boolean hasStoredTrack(String trackId) {
        return trackStore.hasTrack(trackId);
    }

    public boolean deleteStoredTrack(String trackId) {
        return trackStore.deleteTrack(trackId);
    }

    private void notifyPosition() {
        long pos = getPositionMs();
        long dur = getDurationMs();
        for (Listener listener : copyListeners()) {
            listener.onPosition(pos, dur);
        }
    }

    private void persistPositionThrottled() {
        long now = System.currentTimeMillis();
        if (now - lastPersistAt < POSITION_PERSIST_INTERVAL_MS) return;
        lastPersistAt = now;
        persistPosition();
    }

    private void persistPosition() {
        persistPosition(getPositionMs());
    }

    private void persistPosition(long positionMs) {
        lastPersistAt = System.currentTimeMillis();
        prefs.edit().putLong("position_ms", Math.max(0, positionMs)).apply();
    }

    private void registerNoisy() {
        if (noisyRegistered) return;
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        appContext.registerReceiver(becomingNoisy, filter);
        noisyRegistered = true;
    }

    private void unregisterNoisy() {
        if (!noisyRegistered) return;
        try {
            appContext.unregisterReceiver(becomingNoisy);
        } catch (Exception ignored) {
        }
        noisyRegistered = false;
    }

    private void closeCache() {
        if (activeWrite != null) {
            trackStore.abortWrite(activeWrite);
            activeWrite = null;
        }
    }

    private List<Listener> copyListeners() {
        synchronized (listeners) {
            return new ArrayList<>(listeners);
        }
    }
}
