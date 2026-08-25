package com.aether.audio.player.playback;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.Nullable;
import androidx.media3.common.Player;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import com.aether.audio.player.MainActivity;

public class MusicPlayerService extends MediaSessionService {

    public static final String CHANNEL_ID = "aether_playback";

    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();

        PlaybackManager manager = PlaybackManager.get(this);
        Player player = manager.getPlayer();
        Intent sessionIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                sessionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, player)
                .setId("aether-session")
                .setSessionActivity(pendingIntent)
                .build();

        // The session now exists: any playback command queued by
        // PlaybackManager.runWhenServiceReady() is released, guaranteeing the
        // ordering service -> media session -> prepare -> play.
        manager.onServiceReady();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        PlaybackManager.get(this).onServiceDestroyed();
        super.onDestroy();
    }

    /**
     * Decide whether to keep the service alive after the task is swiped away.
     *
     * "About to play" is not the same as playWhenReady: ExoPlayer can sit in
     * STATE_BUFFERING (or be transiently not playing during focus changes)
     * while playWhenReady is still true. The decision must be based on
     * *active playback*: actually playing, or buffering with the intent to
     * play. Only when playback is genuinely inactive do we pause and stop, so
     * Media3 tears down the notification cleanly.
     */
    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player player = mediaSession != null ? mediaSession.getPlayer() : null;
        if (player == null) {
            stopSelf();
            return;
        }

        boolean activelyPlaying =
                player.isPlaying()
                        || (player.getPlayWhenReady()
                            && player.getPlaybackState() == Player.STATE_BUFFERING
                            && player.getMediaItemCount() > 0);

        if (!activelyPlaying) {
            player.pause();
            stopSelf();
        }
        // Still actively playing: keep the service and its notification. The
        // user keeps their music — standard behavior for media apps.
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Aether playback",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Background music playback");
        channel.setShowBadge(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
