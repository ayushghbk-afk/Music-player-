package com.aether.audio.player.model

import android.net.Uri
import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Track(
    val id: Long,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val durationMs: Long,
    val contentUri: String,
    val artworkUri: String,
    val dateAdded: Long = 0L,
    val size: Long = 0L,
    val mimeType: String = "",
) : Parcelable {
    val uri: Uri get() = Uri.parse(contentUri)
    val albumArtUri: Uri get() = Uri.parse(artworkUri)

    val displayArtist: String get() = artist.ifBlank { "Unknown artist" }
    val displayAlbum: String get() = album.ifBlank { "Unknown album" }
}

@Parcelize
data class Playlist(
    val id: String,
    val name: String,
    val trackIds: List<Long> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
) : Parcelable
