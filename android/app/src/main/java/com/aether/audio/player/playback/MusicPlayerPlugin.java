package com.aether.audio.player.playback;

import android.net.Uri;
import android.os.Build;
import android.util.Base64;

import androidx.media3.common.Player;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AetherPlayer")
public class MusicPlayerPlugin extends Plugin implements PlaybackManager.Listener {

    private PlaybackManager manager;

    @Override
    public void load() {
        manager = PlaybackManager.get(getContext());
        manager.addListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) {
            manager.removeListener(this);
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void beginCache(PluginCall call) {
        String trackId = call.getString("trackId", "current");
        String extension = call.getString("extension", "bin");
        try {
            manager.beginCache(trackId, extension);
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void appendCache(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Missing cache chunk");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            manager.appendCache(bytes);
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void playCached(PluginCall call) {
        try {
            File file = manager.endCache();
            playFromUri(Uri.fromFile(file), call);
            call.resolve(currentState());
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void playUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        playFromUri(Uri.parse(url), call);
        call.resolve(currentState());
    }

    @PluginMethod
    public void play(PluginCall call) {
        manager.play();
        call.resolve(currentState());
    }

    @PluginMethod
    public void pause(PluginCall call) {
        manager.pause();
        call.resolve(currentState());
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double seconds = call.getDouble("seconds", 0d);
        manager.seek((long) (seconds * 1000));
        call.resolve(currentState());
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Float volume = call.getFloat("volume", 1f);
        manager.setVolume(volume);
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Float rate = call.getFloat("rate", 1f);
        manager.setPlaybackRate(rate);
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(currentState());
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        JSObject data = currentState();
        data.put("type", "state");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onEnded() {
        JSObject data = currentState();
        data.put("type", "ended");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onPosition(long positionMs, long durationMs) {
        JSObject data = new JSObject();
        data.put("type", "time");
        data.put("currentTime", positionMs / 1000.0);
        data.put("duration", durationMs / 1000.0);
        data.put("isPlaying", manager.isPlaying());
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onSkipToNext() {
        JSObject data = new JSObject();
        data.put("type", "next");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onSkipToPrevious() {
        JSObject data = new JSObject();
        data.put("type", "previous");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onError(String message) {
        JSObject data = new JSObject();
        data.put("type", "error");
        data.put("message", message);
        notifyListeners("playerEvent", data);
    }

    private void playFromUri(Uri uri, PluginCall call) {
        String title = call.getString("title", "Unknown title");
        String artist = call.getString("artist", "Unknown artist");
        String album = call.getString("album", "Aether");
        Double start = call.getDouble("startPosition", 0d);
        manager.playUri(uri, title, artist, album, (long) (start * 1000));
    }

    private JSObject currentState() {
        JSObject state = new JSObject();
        state.put("isPlaying", manager.isPlaying());
        state.put("currentTime", manager.getPositionMs() / 1000.0);
        state.put("duration", manager.getDurationMs() / 1000.0);
        state.put("native", true);
        state.put("sdk", Build.VERSION.SDK_INT);
        Player player = manager.getPlayer();
        state.put("hasItem", player.getMediaItemCount() > 0);
        return state;
    }
}
