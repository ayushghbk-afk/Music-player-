package com.aether.audio.player.model

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

class MusicRepository(private val context: Context) {
    private val gson = Gson()
    private val prefs = context.getSharedPreferences("aether_native", Context.MODE_PRIVATE)

    private val _tracks = MutableStateFlow<List<Track>>(emptyList())
    val tracks: StateFlow<List<Track>> = _tracks.asStateFlow()

    private val _favorites = MutableStateFlow<Set<Long>>(loadFavorites())
    val favorites: StateFlow<Set<Long>> = _favorites.asStateFlow()

    private val _playlists = MutableStateFlow<List<Playlist>>(loadPlaylists())
    val playlists: StateFlow<List<Playlist>> = _playlists.asStateFlow()

    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    suspend fun scanLibrary() = withContext(Dispatchers.IO) {
        _isScanning.value = true
        try {
            val scanned = queryDeviceTracks()
            _tracks.value = scanned
        } finally {
            _isScanning.value = false
        }
    }

    private fun queryDeviceTracks(): List<Track> {
        val results = mutableListOf<Track>()
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.MIME_TYPE,
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= 10000"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"

        context.contentResolver.query(collection, projection, selection, null, sortOrder)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val albumId = cursor.getLong(albumIdCol)
                val contentUri = ContentUris.withAppendedId(collection, id).toString()
                val artworkUri = ContentUris.withAppendedId(
                    android.net.Uri.parse("content://media/external/audio/albumart"),
                    albumId
                ).toString()
                results.add(
                    Track(
                        id = id,
                        title = cursor.getString(titleCol).orEmpty().ifBlank { "Unknown track" },
                        artist = cursor.getString(artistCol).orEmpty(),
                        album = cursor.getString(albumCol).orEmpty(),
                        albumId = albumId,
                        durationMs = cursor.getLong(durationCol),
                        contentUri = contentUri,
                        artworkUri = artworkUri,
                        dateAdded = cursor.getLong(dateCol),
                        size = cursor.getLong(sizeCol),
                        mimeType = cursor.getString(mimeCol).orEmpty(),
                    )
                )
            }
        }
        return results
    }

    fun toggleFavorite(trackId: Long) {
        val next = _favorites.value.toMutableSet()
        if (!next.add(trackId)) next.remove(trackId)
        _favorites.value = next
        prefs.edit().putString("favorites", gson.toJson(next.toList())).apply()
    }

    fun isFavorite(trackId: Long): Boolean = trackId in _favorites.value

    fun createPlaylist(name: String): Playlist {
        val playlist = Playlist(id = java.util.UUID.randomUUID().toString(), name = name.trim().ifBlank { "Playlist" })
        val next = _playlists.value + playlist
        _playlists.value = next
        persistPlaylists(next)
        return playlist
    }

    fun deletePlaylist(id: String) {
        val next = _playlists.value.filterNot { it.id == id }
        _playlists.value = next
        persistPlaylists(next)
    }

    fun addToPlaylist(playlistId: String, trackId: Long) {
        val next = _playlists.value.map { pl ->
            if (pl.id == playlistId && trackId !in pl.trackIds) pl.copy(trackIds = pl.trackIds + trackId) else pl
        }
        _playlists.value = next
        persistPlaylists(next)
    }

    fun removeFromPlaylist(playlistId: String, trackId: Long) {
        val next = _playlists.value.map { pl ->
            if (pl.id == playlistId) pl.copy(trackIds = pl.trackIds.filterNot { it == trackId }) else pl
        }
        _playlists.value = next
        persistPlaylists(next)
    }

    fun tracksForIds(ids: List<Long>): List<Track> {
        val map = _tracks.value.associateBy { it.id }
        return ids.mapNotNull { map[it] }
    }

    private fun loadFavorites(): Set<Long> {
        val raw = prefs.getString("favorites", null) ?: return emptySet()
        return runCatching {
            val type = object : TypeToken<List<Long>>() {}.type
            gson.fromJson<List<Long>>(raw, type).toSet()
        }.getOrDefault(emptySet())
    }

    private fun loadPlaylists(): List<Playlist> {
        val raw = prefs.getString("playlists", null) ?: return emptyList()
        return runCatching {
            val type = object : TypeToken<List<Playlist>>() {}.type
            gson.fromJson<List<Playlist>>(raw, type)
        }.getOrDefault(emptyList())
    }

    private fun persistPlaylists(playlists: List<Playlist>) {
        prefs.edit().putString("playlists", gson.toJson(playlists)).apply()
    }
}
