package com.aether.audio.player.playback;

import android.net.Uri;
import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.provider.MediaStore;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.JSArray;
import android.os.Build;
import android.util.Base64;

import androidx.media3.common.Player;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AetherPlayer", permissions = {
    @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
    @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
})
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

    private String audioPermission() {
        return Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    @PluginMethod
    public void scanAudio(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), audioPermission()) != PackageManager.PERMISSION_GRANTED) {
            if (call.getBoolean("requestPermission", false)) {
                requestPermissionForAlias(Build.VERSION.SDK_INT >= 33 ? "audio" : "storage", call, "audioPermissionResult");
            } else {
                JSObject result = new JSObject();
                result.put("permission", "denied");
                call.resolve(result);
            }
            return;
        }
        queryAudio(call);
    }

    @PermissionCallback
    private void audioPermissionResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), audioPermission()) != PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("permission", "denied");
            call.resolve(result);
            return;
        }
        queryAudio(call);
    }

    private void queryAudio(PluginCall call) {
        // Run the potentially large MediaStore query off the UI thread, including
        // when this method is reached from the permission callback.
        new Thread(() -> {
            try {
                JSArray tracks = new JSArray();
                java.util.Set<String> volumes = Build.VERSION.SDK_INT >= 29
                    ? MediaStore.getExternalVolumeNames(getContext())
                    : java.util.Collections.singleton("external");
                String[] columns = { MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.MIME_TYPE,
                    MediaStore.Audio.Media.DATE_ADDED };
                for (String volume : volumes) {
                    Uri collection = Build.VERSION.SDK_INT >= 29
                        ? MediaStore.Audio.Media.getContentUri(volume) : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                    try (Cursor cursor = getContext().getContentResolver().query(collection, columns, null, null, null)) {
                        if (cursor == null) throw new IllegalStateException("Android media library is unavailable");
                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(0);
                            JSObject track = new JSObject();
                            track.put("id", "media-" + volume + "-" + id);
                            track.put("uri", ContentUris.withAppendedId(collection, id).toString());
                            track.put("name", cursor.getString(1));
                            track.put("title", cursor.getString(2));
                            track.put("artist", cursor.getString(3));
                            track.put("album", cursor.getString(4));
                            track.put("duration", cursor.getLong(5));
                            track.put("size", cursor.getLong(6));
                            track.put("mimeType", cursor.getString(7));
                            track.put("addedAt", cursor.getLong(8));
                            tracks.put(track);
                        }
                    }
                }
                JSObject result = new JSObject();
                result.put("permission", "granted");
                result.put("tracks", tracks);
                JSArray scannedVolumes = new JSArray();
                for (String volume : volumes) scannedVolumes.put(volume);
                result.put("volumes", scannedVolumes);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Unable to scan Android audio: " + error.getMessage(), error);
            }
        }, "aether-media-scan").start();
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
        boolean cloud = call.getBoolean("cloud", false);
        boolean local = "file".equals(uri.getScheme()) || "content".equals(uri.getScheme());
        if (!local && !(cloud && "https".equals(uri.getScheme()))) { call.reject("Only local audio or authenticated HTTPS cloud streams are allowed"); return; }
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
                String source = track.optString("sourceUri", "");
                boolean cloud = track.optBoolean("cloud", false);
                if (cloud) source = track.optString("audioUrl", "");
                Uri uri = Uri.parse(source);
                boolean cloudStream = cloud && "https".equals(uri.getScheme());
                if (!cloudStream && (!"content".equals(uri.getScheme()) || !"media".equals(uri.getAuthority()))) {
                    File file = manager.findStoredTrack(track.getString("id"));
                    if (file == null) continue;
                    uri = Uri.fromFile(file);
                }
                items.add(new androidx.media3.common.MediaItem.Builder().setMediaId(track.getString("id"))
                    .setUri(uri).setMediaMetadata(new androidx.media3.common.MediaMetadata.Builder()
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
            StudioRack rack=StudioRack.disabled();
            com.getcapacitor.JSObject rackJson=call.getObject("rack");
            if(rackJson!=null) {
                org.json.JSONArray peq=rackJson.getJSONArray("parametric");
                if(peq.length()!=3) throw new IllegalArgumentException("Expected three parametric bands");
                double[][] parametric=new double[3][3];
                for(int i=0;i<3;i++) {
                    org.json.JSONObject band=peq.getJSONObject(i);
                    parametric[i]=new double[]{band.getDouble("frequency"),band.getDouble("gain"),band.getDouble("q")};
                }
                rack=new StudioRack(rackJson.getBoolean("enabled"),rackJson.getDouble("highPassHz"),rackJson.getDouble("lowPassHz"),
                    parametric,rackJson.getDouble("outputTrimDb"),rackJson.getDouble("delayMs"),
                    rackJson.getBoolean("invertLeft"),rackJson.getBoolean("invertRight"));
            }
            manager.applyEQ(call.getBoolean("enabled", true), bands,
                Math.max(-12,Math.min(12,call.getDouble("preamp", 0d))),
                Math.max(0,Math.min(100,call.getDouble("bassBoost", 0d))),
                Math.max(0,Math.min(100,call.getDouble("trebleBoost", 0d))),
                Math.max(0,Math.min(200,call.getDouble("stereoWidth", 100d))),
                call.getBoolean("autoHeadroom",true),call.getBoolean("peakProtection",true),
                Math.max(-1,Math.min(1,call.getDouble("balance",0d))),call.getBoolean("mono",false),rack);
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
