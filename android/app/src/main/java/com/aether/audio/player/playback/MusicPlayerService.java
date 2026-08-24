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

        Player player = PlaybackManager.get(this).getPlayer();
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
                .setCallback(new SessionCallback())
                .build();
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
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Player player = mediaSession != null ? mediaSession.getPlayer() : null;
        if (player == null || !player.getPlayWhenReady() || player.getMediaItemCount() == 0) {
            stopSelf();
        }
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

    private static final class SessionCallback implements MediaSession.Callback {
        @Override
        public boolean onMediaButtonEvent(MediaSession session, android.content.Intent mediaButtonIntent) {
            return MediaSession.Callback.super.onMediaButtonEvent(session, mediaButtonIntent);
        }
    }
}
