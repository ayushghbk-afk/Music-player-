package com.aether.audio.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aether.audio.player.model.Playlist
import com.aether.audio.player.model.Track
import com.aether.audio.player.ui.components.EmptyState
import com.aether.audio.player.ui.components.TrackArtwork
import com.aether.audio.player.ui.components.TrackRow
import com.aether.audio.player.ui.theme.AetherColors

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
        Box(Modifier.fillMaxSize().background(AetherColors.Background), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = AetherColors.Accent) }
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(AetherColors.Background),
        contentPadding = PaddingValues(bottom = 140.dp, top = 4.dp, start = 8.dp, end = 8.dp)
    ) {
        item {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
                Text("YOUR SPACE. YOUR SOUND.", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp), color = AetherColors.Muted2)
                Spacer(Modifier.height(6.dp))
                Text("A little closer\nto the music.", style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.SemiBold, lineHeight = 38.sp), color = AetherColors.Text)
                Spacer(Modifier.height(6.dp))
                Text("A collection that’s entirely yours. Every detail, every note.", style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted)
            }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                shape = RoundedCornerShape(18.dp),
                color = AetherColors.Surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)
            ) {
                Box(
                    Modifier.fillMaxWidth().background(
                        Brush.linearGradient(listOf(AetherColors.Accent.copy(alpha = 0.18f), AetherColors.Surface, Color(0xFF111214)))
                    ).padding(20.dp)
                ) {
                    Column {
                        Text("THE AETHER LISTENING ROOM", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Accent)
                        Spacer(Modifier.height(10.dp))
                        Text("Less noise.\nMore feeling.", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
                        Spacer(Modifier.height(8.dp))
                        Text("Rediscover the details you fell in love with.", color = AetherColors.Muted, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("In your library", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
                Spacer(Modifier.width(8.dp))
                Text("${tracks.size} tracks", style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted2)
            }
        }
        if (tracks.isEmpty()) {
            item { EmptyState("Make room for your music.", "Grant access and scan your device to build your collection.") }
        } else {
            items(tracks, key = { it.id }) { track ->
                var menuOpen by remember { mutableStateOf(false) }
                Box {
                    TrackRow(
                        track = track,
                        isActive = track.id == currentTrackId,
                        isPlaying = track.id == currentTrackId,
                        onClick = { onPlay(track, tracks) },
                        trailing = {
                            IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Options", tint = AetherColors.Muted) }
                        }
                    )
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }, containerColor = AetherColors.Surface) {
                        DropdownMenuItem(
                            text = { Text(if (track.id in favorites) "Remove favorite" else "Add favorite", color = AetherColors.Text) },
                            onClick = { onToggleFavorite(track.id); menuOpen = false },
                            leadingIcon = { Icon(if (track.id in favorites) Icons.Default.Favorite else Icons.Default.FavoriteBorder, null, tint = AetherColors.Accent) }
                        )
                        DropdownMenuItem(
                            text = { Text("Add to playlist", color = AetherColors.Text) },
                            onClick = { onAddToPlaylist(track); menuOpen = false },
                            leadingIcon = { Icon(Icons.Default.PlaylistAdd, null, tint = AetherColors.Accent) }
                        )
                    }
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
    LazyColumn(modifier = Modifier.fillMaxSize().background(AetherColors.Background), contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
        item { ScreenIntro("YOUR COLLECTION", "Albums & artists", "Browse the albums in your library.") }
        if (albums.isEmpty()) { item { EmptyState("No albums", "Albums appear after your music library is scanned.") } }
        else items(albums, key = { it.first + it.second + it.third.size }) { (name, artist, list) ->
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { onOpenAlbum(name, list) }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrackArtwork(list.first().artworkUri, Modifier.size(58.dp), radius = 12)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium), color = AetherColors.Text)
                    Text("$artist • ${list.size} songs", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted)
                }
                Icon(Icons.Default.ChevronRight, null, tint = AetherColors.Muted2)
            }
        }
    }
}

@Composable
fun ArtistsScreen(tracks: List<Track>, onOpenArtist: (String, List<Track>) -> Unit) {
    val artists = remember(tracks) {
        tracks.groupBy { it.artist.ifBlank { "Unknown artist" } }.map { (name, list) -> name to list }.sortedBy { it.first.lowercase() }
    }
    LazyColumn(modifier = Modifier.fillMaxSize().background(AetherColors.Background), contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp)) {
        items(artists, key = { it.first }) { (name, list) ->
            Row(
                modifier = Modifier.fillMaxWidth().clickable { onOpenArtist(name, list) }.padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrackArtwork(list.first().artworkUri, Modifier.size(54.dp))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis, color = AetherColors.Text)
                    Text("${list.size} songs", style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted)
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
            containerColor = AetherColors.Surface,
            title = { Text("New playlist", color = AetherColors.Text) },
            text = { OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Playlist name") }, singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedTextColor = AetherColors.Text, unfocusedTextColor = AetherColors.Text, focusedBorderColor = AetherColors.Accent, cursorColor = AetherColors.Accent)) },
            confirmButton = { TextButton(onClick = { onCreate(name); name = ""; showCreate = false }) { Text("Create", color = AetherColors.Accent) } },
            dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = AetherColors.Muted) } }
        )
    }
    LazyColumn(modifier = Modifier.fillMaxSize().background(AetherColors.Background), contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp)) {
        item { ScreenIntro("YOUR COLLECTION", "Playlists", "Your sets, your moods, your order.") }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                FilledTonalButton(onClick = { showCreate = true }, colors = ButtonDefaults.filledTonalButtonColors(containerColor = AetherColors.Accent.copy(alpha = 0.14f), contentColor = AetherColors.Accent)) {
                    Icon(Icons.Default.Add, null); Spacer(Modifier.width(4.dp)); Text("New playlist")
                }
            }
        }
        item {
            PlaylistRow("Favorites", "$favoritesCount songs", Icons.Default.Favorite, onClick = onOpenFavorites)
        }
        items(playlists, key = { it.id }) { pl ->
            PlaylistRow(pl.name, "${pl.trackIds.size} songs", Icons.Default.QueueMusic, onClick = { onOpen(pl) }, trailing = {
                IconButton(onClick = { onDelete(pl.id) }) { Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = AetherColors.Muted) }
            })
        }
    }
}

@Composable
private fun PlaylistRow(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, trailing: @Composable (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(48.dp).background(AetherColors.Accent.copy(alpha = 0.1f), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = AetherColors.Accent)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = AetherColors.Text, fontWeight = FontWeight.Medium)
            Text(subtitle, color = AetherColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
        trailing?.invoke() ?: Icon(Icons.Default.ChevronRight, null, tint = AetherColors.Muted2)
    }
}

@Composable
private fun ScreenIntro(eyebrow: String, title: String, subtitle: String) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(eyebrow, style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp), color = AetherColors.Muted2)
        Spacer(Modifier.height(6.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted)
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
    Scaffold(
        containerColor = AetherColors.Background,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
                title = { Column { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = AetherColors.Text); Text(subtitle, style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted) } },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = AetherColors.Text) } }
            )
        }
    ) { padding ->
        if (tracks.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding).background(AetherColors.Background), contentAlignment = Alignment.Center) { EmptyState("No tracks", "This collection is empty.") }
        } else {
            LazyColumn(modifier = Modifier.padding(padding).background(AetherColors.Background), contentPadding = PaddingValues(bottom = 140.dp, top = 8.dp, start = 8.dp, end = 8.dp)) {
                itemsIndexed(tracks, key = { _, t -> t.id }) { _, track ->
                    TrackRow(track = track, isActive = track.id == currentTrackId, isPlaying = track.id == currentTrackId, onClick = { onPlay(track, tracks) })
                }
            }
        }
    }
}
