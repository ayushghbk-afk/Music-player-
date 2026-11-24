package com.aether.audio.player.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aether.audio.player.AetherApp
import com.aether.audio.player.model.Playlist
import com.aether.audio.player.model.Track
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class LibraryUiState(
    val query: String = "",
    val selectedTab: Int = 0,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val aether = app as AetherApp
    val repository = aether.repository
    val player = aether.playerController

    private val _ui = MutableStateFlow(LibraryUiState())
    val ui: StateFlow<LibraryUiState> = _ui.asStateFlow()

    val tracks = repository.tracks
    val favorites = repository.favorites
    val playlists = repository.playlists
    val isScanning = repository.isScanning
    val playerState = player.state

    val filteredTracks: StateFlow<List<Track>> = combine(tracks, _ui) { list, ui ->
        val q = ui.query.trim().lowercase()
        if (q.isEmpty()) list
        else list.filter {
            it.title.lowercase().contains(q) ||
            it.artist.lowercase().contains(q) ||
            it.album.lowercase().contains(q)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setQuery(query: String) { _ui.value = _ui.value.copy(query = query) }
    fun setTab(tab: Int) { _ui.value = _ui.value.copy(selectedTab = tab) }

    fun scan() { viewModelScope.launch { repository.scanLibrary() } }

    fun playTrack(track: Track, queue: List<Track>? = null) {
        player.playTrack(track, queue ?: tracks.value)
    }

    fun playTracks(tracks: List<Track>, startIndex: Int = 0) { player.playTracks(tracks, startIndex) }

    fun toggleFavorite(trackId: Long) = repository.toggleFavorite(trackId)
    fun createPlaylist(name: String): Playlist = repository.createPlaylist(name)
    fun deletePlaylist(id: String) = repository.deletePlaylist(id)
    fun addToPlaylist(playlistId: String, trackId: Long) = repository.addToPlaylist(playlistId, trackId)
    fun removeFromPlaylist(playlistId: String, trackId: Long) = repository.removeFromPlaylist(playlistId, trackId)
    fun tracksForIds(ids: List<Long>) = repository.tracksForIds(ids)
}
