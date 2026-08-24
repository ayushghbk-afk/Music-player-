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
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;

public final class PlaybackManager {

    public interface Listener {
        void onIsPlayingChanged(boolean isPlaying);
        void onEnded();
        void onPosition(long positionMs, long durationMs);
        void onSkipToNext();
        void onSkipToPrevious();
        void onError(String message);
    }

    private static PlaybackManager instance;

    private final Context appContext;
    private final ExoPlayer exoPlayer;
    private final Player player;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<Listener> listeners = new ArrayList<>();
    private final SharedPreferences prefs;

    private File cacheFile;
    private FileOutputStream cacheOut;
    private boolean noisyRegistered;
    private final Runnable positionTick = new Runnable() {
        @Override
        public void run() {
            notifyPosition();
            persistPosition();
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

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        exoPlayer = new ExoPlayer.Builder(appContext).build();
        exoPlayer.setAudioAttributes(attrs, true);
        exoPlayer.setHandleAudioBecomingNoisy(true);
        exoPlayer.setWakeMode(C.WAKE_MODE_LOCAL);
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

    public static synchronized PlaybackManager get(Context context) {
        if (instance == null) {
            instance = new PlaybackManager(context);
        }
        return instance;
    }

    public Player getPlayer() {
        return player;
    }

    public void addListener(Listener listener) {
        listeners.add(listener);
    }

    public void removeListener(Listener listener) {
        listeners.remove(listener);
    }

    public void beginCache(String trackId, String extension) throws Exception {
        closeCache();
        File dir = new File(appContext.getCacheDir(), "aether-tracks");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Unable to create cache directory");
        }
        cacheFile = new File(dir, sanitize(trackId) + (extension.startsWith(".") ? extension : "." + extension));
        cacheOut = new FileOutputStream(cacheFile, false);
    }

    public void appendCache(byte[] chunk) throws Exception {
        if (cacheOut == null) {
            throw new Exception("Cache write has not been started");
        }
        cacheOut.write(chunk);
    }

    public File endCache() throws Exception {
        if (cacheOut != null) {
            cacheOut.flush();
            cacheOut.close();
            cacheOut = null;
        }
        if (cacheFile == null || !cacheFile.exists()) {
            throw new Exception("No cached audio file");
        }
        return cacheFile;
    }

    public void playFile(File file, String title, String artist, String album, long startPositionMs) {
        playUri(Uri.fromFile(file), title, artist, album, startPositionMs);
    }

    public void playUri(Uri uri, String title, String artist, String album, long startPositionMs) {
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
        startService();
    }

    public void play() {
        player.play();
        startService();
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

    private void startService() {
        Intent intent = new Intent(appContext, MusicPlayerService.class);
        appContext.startForegroundService(intent);
    }

    private void notifyPosition() {
        long pos = getPositionMs();
        long dur = getDurationMs();
        for (Listener listener : copyListeners()) {
            listener.onPosition(pos, dur);
        }
    }

    private void persistPosition() {
        persistPosition(getPositionMs());
    }

    private void persistPosition(long positionMs) {
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
        try {
            if (cacheOut != null) {
                cacheOut.close();
            }
        } catch (Exception ignored) {
        }
        cacheOut = null;
    }

    private List<Listener> copyListeners() {
        return new ArrayList<>(listeners);
    }

    private static String sanitize(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
