package com.aether.audio.player.player

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.aether.audio.player.model.Track
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.guava.await

data class PlayerUiState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val shuffleEnabled: Boolean = false,
    val repeatMode: Int = Player.REPEAT_MODE_OFF,
    val queue: List<Track> = emptyList(),
    val currentIndex: Int = -1,
)

class PlayerController(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var controller: MediaController? = null
    private var positionJob: Job? = null
    private var trackResolver: (String) -> Track? = { null }

    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state.asStateFlow()

    fun setTrackResolver(resolver: (String) -> Track?) {
        trackResolver = resolver
    }

    suspend fun connect() {
        if (controller != null) return
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val ctrl = MediaController.Builder(context, token).buildAsync().await()
        controller = ctrl
        ctrl.addListener(listener)
        syncFromController(ctrl)
    }

    fun release() {
        positionJob?.cancel()
        controller?.removeListener(listener)
        controller?.release()
        controller = null
        scope.cancel()
    }

    fun disconnect() {
        positionJob?.cancel()
        controller?.removeListener(listener)
        controller?.release()
        controller = null
    }

    fun playTracks(tracks: List<Track>, startIndex: Int = 0) {
        val ctrl = controller ?: return
        if (tracks.isEmpty()) return
        val items = tracks.map { it.toMediaItem() }
        ctrl.setMediaItems(items, startIndex.coerceIn(0, tracks.lastIndex), 0L)
        ctrl.prepare()
        ctrl.play()
        _state.value = _state.value.copy(queue = tracks, currentIndex = startIndex.coerceIn(0, tracks.lastIndex))
    }

    fun playTrack(track: Track, queue: List<Track> = listOf(track)) {
        val index = queue.indexOfFirst { it.id == track.id }.takeIf { it >= 0 } ?: 0
        val actualQueue = if (queue.any { it.id == track.id }) queue else listOf(track)
        playTracks(actualQueue, actualQueue.indexOfFirst { it.id == track.id }.takeIf { it >= 0 } ?: index)
    }

    fun togglePlayPause() {
        val ctrl = controller ?: return
        if (ctrl.isPlaying) ctrl.pause() else {
            if (ctrl.playbackState == Player.STATE_IDLE) ctrl.prepare()
            ctrl.play()
        }
    }

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs.coerceAtLeast(0L))
    }

    fun seekToIndex(index: Int) {
        val ctrl = controller ?: return
        if (index in 0 until ctrl.mediaItemCount) {
            ctrl.seekToDefaultPosition(index)
            ctrl.play()
        }
    }

    fun next() { controller?.seekToNextMediaItem() }
    fun previous() {
        val ctrl = controller ?: return
        if (ctrl.currentPosition > 3000) ctrl.seekTo(0) else ctrl.seekToPreviousMediaItem()
    }

    fun toggleShuffle() {
        val ctrl = controller ?: return
        ctrl.shuffleModeEnabled = !ctrl.shuffleModeEnabled
    }

    fun cycleRepeatMode() {
        val ctrl = controller ?: return
        ctrl.repeatMode = when (ctrl.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    fun addToQueue(track: Track) {
        val ctrl = controller ?: return
        ctrl.addMediaItem(track.toMediaItem())
        _state.value = _state.value.copy(queue = _state.value.queue + track)
    }

    fun stop() {
        controller?.stop()
        controller?.clearMediaItems()
        _state.value = PlayerUiState()
    }

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) { syncFromController(controller) }
        override fun onPlaybackStateChanged(playbackState: Int) { syncFromController(controller) }
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) { syncFromController(controller) }
        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) { syncFromController(controller) }
        override fun onRepeatModeChanged(repeatMode: Int) { syncFromController(controller) }
        override fun onEvents(player: Player, events: Player.Events) { syncFromController(controller) }
    }

    private fun syncFromController(ctrl: MediaController?) {
        val c = ctrl ?: return
        val mediaId = c.currentMediaItem?.mediaId
        val current = mediaId?.toLongOrNull()?.let { id ->
            _state.value.queue.find { it.id == id } ?: trackResolver(mediaId)
        }
        val duration = c.duration.takeIf { it > 0 } ?: current?.durationMs ?: 0L
        _state.value = _state.value.copy(
            currentTrack = current ?: _state.value.currentTrack?.takeIf { c.mediaItemCount > 0 },
            isPlaying = c.isPlaying,
            isBuffering = c.playbackState == Player.STATE_BUFFERING,
            positionMs = c.currentPosition.coerceAtLeast(0L),
            durationMs = duration,
            shuffleEnabled = c.shuffleModeEnabled,
            repeatMode = c.repeatMode,
            currentIndex = c.currentMediaItemIndex,
        )
        if (c.isPlaying) startPositionUpdates() else stopPositionUpdates()
    }

    private fun startPositionUpdates() {
        if (positionJob?.isActive == true) return
        positionJob = scope.launch {
            while (isActive) {
                controller?.let { c ->
                    _state.value = _state.value.copy(
                        positionMs = c.currentPosition.coerceAtLeast(0L),
                        durationMs = c.duration.takeIf { it > 0 } ?: _state.value.durationMs,
                    )
                }
                delay(500)
            }
        }
    }

    private fun stopPositionUpdates() {
        positionJob?.cancel()
        positionJob = null
    }
}

fun Track.toMediaItem(): MediaItem {
    val metadata = MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(displayArtist)
        .setAlbumTitle(displayAlbum)
        .setArtworkUri(Uri.parse(artworkUri))
        .build()
    return MediaItem.Builder()
        .setMediaId(id.toString())
        .setUri(contentUri)
        .setMediaMetadata(metadata)
        .build()
}
