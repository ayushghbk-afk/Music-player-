package com.aether.audio.player.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aether.audio.player.model.Playlist
import com.aether.audio.player.model.Track
import com.aether.audio.player.ui.components.EmptyState
import com.aether.audio.player.ui.components.TrackArtwork
import com.aether.audio.player.ui.components.TrackRow

@Composable
fun SongsScreen(
    tracks: List<Track>,
    currentTrackId: Long?,
    favorites: Set<Long>,
    isScanning: Boolean,
    onPlay: (Track, List<Track>) -> Unit,
    onToggleFavorite: (Long) -> Unit,
    onAddToPlaylist: (Track) -> Unit,
) {
    if (isScanning && tracks.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }
    if (tracks.isEmpty()) {
        EmptyState("No songs found", "Grant music access and scan your device to see your library.")
        return
    }
    LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
        items(tracks, key = { it.id }) { track ->
            var menuOpen by remember { mutableStateOf(false) }
            Box {
                TrackRow(
                    track = track,
                    isActive = track.id == currentTrackId,
                    onClick = { onPlay(track, tracks) },
                    trailing = {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Options") }
                    }
                )
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text(if (track.id in favorites) "Remove favorite" else "Add favorite") },
                        onClick = { onToggleFavorite(track.id); menuOpen = false },
                        leadingIcon = { Icon(if (track.id in favorites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, null) }
                    )
                    DropdownMenuItem(
                        text = { Text("Add to playlist") },
                        onClick = { onAddToPlaylist(track); menuOpen = false },
                        leadingIcon = { Icon(Icons.Default.Add, null) }
                    )
                }
            }
        }
    }
}

@Composable
fun AlbumsScreen(tracks: List<Track>, onOpenAlbum: (String, List<Track>) -> Unit) {
    val albums = remember(tracks) {
        tracks.groupBy { it.albumId }.map { (_, list) ->
            val first = list.first()
            Triple(first.album.ifBlank { "Unknown album" }, first.artist.ifBlank { "Unknown artist" }, list)
        }.sortedBy { it.first.lowercase() }
    }
    if (albums.isEmpty()) { EmptyState("No albums", "Albums appear after your music library is scanned."); return }
    LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
        items(albums, key = { it.first + it.second }) { (name, artist, list) ->
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onOpenAlbum(name, list) }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrackArtwork(list.first().artworkUri, Modifier.size(56.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
                    Text("$artist • ${list.size} songs", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun ArtistsScreen(tracks: List<Track>, onOpenArtist: (String, List<Track>) -> Unit) {
    val artists = remember(tracks) {
        tracks.groupBy { it.artist.ifBlank { "Unknown artist" } }
            .map { (name, list) -> name to list }
            .sortedBy { it.first.lowercase() }
    }
    if (artists.isEmpty()) { EmptyState("No artists", "Artists appear after your music library is scanned."); return }
    LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
        items(artists, key = { it.first }) { (name, list) ->
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onOpenArtist(name, list) }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrackArtwork(list.first().artworkUri, Modifier.size(56.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
                    Text("${list.size} songs", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun PlaylistsScreen(
    playlists: List<Playlist>,
    favoritesCount: Int,
    onCreate: (String) -> Unit,
    onOpen: (Playlist) -> Unit,
    onOpenFavorites: () -> Unit,
    onDelete: (String) -> Unit,
) {
    var showCreate by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }

    if (showCreate) {
        AlertDialog(
            onDismissRequest = { showCreate = false },
            title = { Text("New playlist") },
            text = { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Playlist name") }, singleLine = true) },
            confirmButton = {
                TextButton(onClick = { onCreate(name); name = ""; showCreate = false }) { Text("Create") }
            },
            dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel") } }
        )
    }

    LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Playlists", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                FilledTonalButton(onClick = { showCreate = true }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(4.dp)); Text("New") }
            }
        }
        item {
            ListItem(
                headlineContent = { Text("Favorites") },
                supportingContent = { Text("$favoritesCount songs") },
                leadingContent = { Icon(Icons.Default.Favorite, null, tint = MaterialTheme.colorScheme.primary) },
                modifier = Modifier.clickable(onClick = onOpenFavorites)
            )
        }
        items(playlists, key = { it.id }) { pl ->
            ListItem(
                headlineContent = { Text(pl.name) },
                supportingContent = { Text("${pl.trackIds.size} songs") },
                trailingContent = {
                    IconButton(onClick = { onDelete(pl.id) }) { Icon(Icons.Default.Delete, contentDescription = "Delete") }
                },
                modifier = Modifier.clickable { onOpen(pl) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackCollectionScreen(
    title: String,
    subtitle: String,
    tracks: List<Track>,
    currentTrackId: Long?,
    onBack: () -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
) {
    Scaffold(topBar = {
        TopAppBar(
            title = { Column { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") } }
        )
    }) { padding ->
        if (tracks.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { EmptyState("No tracks", "This collection is empty.") }
        } else {
            LazyColumn(modifier = Modifier.padding(padding), contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
                itemsIndexed(tracks, key = { _, t -> t.id }) { _, track ->
                    TrackRow(track = track, isActive = track.id == currentTrackId, onClick = { onPlay(track, tracks) })
                }
            }
        }
    }
}
