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
@androidx.media3.common.util.UnstableApi
public class MusicPlayerPlugin extends Plugin implements PlaybackManager.Listener {

    private PlaybackManager manager;
    private LocalTrackServer trackServer;

    @Override
    public void load() {
        manager = PlaybackManager.get(getContext());
        manager.addListener(this);
        startTrackServer();
    }

    private void startTrackServer() {
        if (trackServer != null && trackServer.isRunning()) return;
        try {
            trackServer = LocalTrackServer.start(manager.getTrackStore());
        } catch (Exception error) {
            // Streaming import unavailable; the WebView falls back to chunked
            // (base64) imports through this same plugin.
            trackServer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) {
            manager.removeListener(this);
        }
        if (trackServer != null) {
            trackServer.stop();
            trackServer = null;
        }
        super.handleOnDestroy();
    }

    // ---------------------------------------------------------------------
    // Imports
    // ---------------------------------------------------------------------

    /** Loopback endpoint info for streamed (non-base64) imports from the WebView. */
    @PluginMethod
    public void getServerInfo(PluginCall call) {
        startTrackServer();
        JSObject info = new JSObject();
        if (trackServer != null && trackServer.isRunning()) {
            info.put("available", true);
            info.put("port", trackServer.getPort());
            info.put("token", trackServer.getToken());
        } else {
            info.put("available", false);
        }
        call.resolve(info);
    }

    @PluginMethod
    public void hasTrack(PluginCall call) {
        String trackId = call.getString("trackId");
        if (trackId == null || trackId.isEmpty()) {
            call.reject("Missing trackId");
            return;
        }
        JSObject result = new JSObject();
        result.put("available", manager.hasStoredTrack(trackId));
        call.resolve(result);
    }

    @PluginMethod
    public void deleteTrack(PluginCall call) {
        String trackId = call.getString("trackId");
        if (trackId == null || trackId.isEmpty()) {
            call.reject("Missing trackId");
            return;
        }
        manager.deleteStoredTrack(trackId);
        call.resolve();
    }

    @PluginMethod
    public void clearTracks(PluginCall call) {
        JSObject result = new JSObject();
        result.put("removed", manager.getTrackStore().clearAll());
        call.resolve(result);
    }

    /** Chunked (base64) import fallback: begin. */
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

    /** Chunked (base64) import fallback: append bytes. */
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

    /** Chunked (base64) import fallback: finalize without playing. */
    @PluginMethod
    public void commitCache(PluginCall call) {
        try {
            File file = manager.commitCache();
            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    /** Chunked (base64) import fallback: finalize and play immediately. */
    @PluginMethod
    public void playCached(PluginCall call) {
        try {
            File file = manager.endCache();
            getBridge().executeOnMainThread(() -> {
                playFromUri(Uri.fromFile(file), call);
                call.resolve(currentState());
            });
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Playback
    //
    // Capacitor invokes @PluginMethod on a bridge thread, but ExoPlayer is
    // owned by the main looper and asserts single-thread access. Every
    // method that touches the player is therefore dispatched to main;
    // call.resolve() is safe from any thread.
    // ---------------------------------------------------------------------

    @PluginMethod
    public void playStored(PluginCall call) {
        String trackId = call.getString("trackId");
        if (trackId == null || trackId.isEmpty()) {
            call.reject("Missing trackId");
            return;
        }
        File file = manager.findStoredTrack(trackId);
        if (file == null || !file.exists()) {
            call.reject("Track is not imported on this device");
            return;
        }
        getBridge().executeOnMainThread(() -> {
            playFromUri(Uri.fromFile(file), call);
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void playUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        Uri uri = Uri.parse(url);
        if (!"file".equals(uri.getScheme()) && !"content".equals(uri.getScheme())) { call.reject("Only local audio is allowed"); return; }
        getBridge().executeOnMainThread(() -> {
            playFromUri(uri, call);
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            manager.play();
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            manager.pause();
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double seconds = call.getDouble("seconds", 0d);
        getBridge().executeOnMainThread(() -> {
            manager.seek((long) (seconds * 1000));
            call.resolve(currentState());
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Float volume = call.getFloat("volume", 1f);
        getBridge().executeOnMainThread(() -> {
            manager.setVolume(volume);
            call.resolve();
        });
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Float rate = call.getFloat("rate", 1f);
        getBridge().executeOnMainThread(() -> {
            manager.setPlaybackRate(rate);
            call.resolve();
        });
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        try {
            org.json.JSONArray tracks = call.getArray("tracks");
            java.util.List<androidx.media3.common.MediaItem> items = new java.util.ArrayList<>();
            if (tracks != null) for(int i=0;i<tracks.length();i++) {
                org.json.JSONObject track=tracks.getJSONObject(i);
                File file=manager.findStoredTrack(track.getString("id"));
                if(file==null) continue;
                items.add(new androidx.media3.common.MediaItem.Builder().setMediaId(track.getString("id"))
                    .setUri(Uri.fromFile(file)).setMediaMetadata(new androidx.media3.common.MediaMetadata.Builder()
                    .setTitle(track.optString("title")).setArtist(track.optString("artist")).setAlbumTitle(track.optString("album")).build()).build());
            }
            int repeat = "one".equals(call.getString("repeat")) ? Player.REPEAT_MODE_ONE : "all".equals(call.getString("repeat")) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF;
            getBridge().executeOnMainThread(() -> {
                manager.setQueue(items,call.getBoolean("shuffle",false),repeat,call.getBoolean("autoplay",true));
                call.resolve();
            });
        } catch(Exception error) { call.reject("Invalid queue",error); }
    }

    @PluginMethod
    public void applyEQ(PluginCall call) {
        try {
            org.json.JSONArray values = call.getArray("bands");
            if (values == null || values.length() != 10) { call.reject("Expected ten EQ bands"); return; }
            double[] bands = new double[10];
            for(int i=0;i<10;i++) bands[i]=Math.max(-12, Math.min(12, values.getDouble(i)));
            manager.applyEQ(call.getBoolean("enabled", true), bands,
                Math.max(-12,Math.min(12,call.getDouble("preamp", 0d))),
                Math.max(0,Math.min(100,call.getDouble("bassBoost", 0d))),
                Math.max(0,Math.min(100,call.getDouble("trebleBoost", 0d))),
                Math.max(0,Math.min(200,call.getDouble("stereoWidth", 100d))),
                call.getBoolean("autoHeadroom",true),call.getBoolean("peakProtection",true),
                Math.max(-1,Math.min(1,call.getDouble("balance",0d))),call.getBoolean("mono",false));
            call.resolve();
        } catch(Exception error) { call.reject("Invalid DSP settings", error); }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getBridge().executeOnMainThread(() -> call.resolve(currentState()));
    }

    // ---------------------------------------------------------------------
    // Events to the WebView
    // ---------------------------------------------------------------------

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        JSObject data = currentState();
        data.put("type", "state");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onTrackChanged(String trackId) {
        JSObject data = currentState();
        data.put("type", "track"); data.put("trackId", trackId);
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onBufferingChanged(boolean buffering) {
        JSObject data=currentState();
        data.put("type",buffering ? "buffering" : "ready");
        notifyListeners("playerEvent",data);
    }

    @Override
    public void onEnded() {
        JSObject data = currentState();
        data.put("type", "ended");
        notifyListeners("playerEvent", data);
    }

    @Override
    public void onPosition(long positionMs, long durationMs) {
        JSObject data = currentState();
        AetherDspProcessor.Meter meter=manager.getMeter();
        double volume=manager.getVolume();
        JSObject levels=new JSObject();
        levels.put("left",meter.left*volume); levels.put("right",meter.right*volume);
        levels.put("peak",meter.peak*volume); levels.put("overloaded",meter.overloaded);
        data.put("meter",levels);
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
        manager.playUri(uri, title, artist, album, (long) (start * 1000), call.getString("trackId", ""));
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
        if (player.getCurrentMediaItem() != null) state.put("trackId", player.getCurrentMediaItem().mediaId);
        return state;
    }
}
