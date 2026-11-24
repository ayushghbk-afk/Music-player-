package com.aether.audio.player.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.aether.audio.player.model.Playlist
import com.aether.audio.player.model.Track
import com.aether.audio.player.ui.components.EmptyState
import com.aether.audio.player.ui.components.MiniPlayer
import com.aether.audio.player.ui.components.TrackRow
import com.aether.audio.player.ui.screens.*

private sealed class Screen(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    data object Songs : Screen("songs", "Songs", Icons.Default.MusicNote)
    data object Albums : Screen("albums", "Albums", Icons.Default.Album)
    data object Artists : Screen("artists", "Artists", Icons.Default.Person)
    data object Playlists : Screen("playlists", "Playlists", Icons.Default.QueueMusic)
    data object Search : Screen("search", "Search", Icons.Default.Search)
}

private val bottomScreens = listOf(Screen.Songs, Screen.Albums, Screen.Artists, Screen.Playlists, Screen.Search)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AetherRoot(viewModel: MainViewModel) {
    val context = LocalContext.current
    val nav = rememberNavController()
    val tracks by viewModel.tracks.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val playlists by viewModel.playlists.collectAsStateWithLifecycle()
    val isScanning by viewModel.isScanning.collectAsStateWithLifecycle()
    val playerState by viewModel.playerState.collectAsStateWithLifecycle()
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val filtered by viewModel.filteredTracks.collectAsStateWithLifecycle()

    var hasAudioPermission by remember {
        mutableStateOf(hasAudioPermission(context))
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        hasAudioPermission = hasAudioPermission(context)
        if (hasAudioPermission) viewModel.scan()
    }

    var pendingAddTrack by remember { mutableStateOf<Track?>(null) }
    var showNowPlaying by remember { mutableStateOf(false) }
    var detailTitle by remember { mutableStateOf("") }
    var detailSubtitle by remember { mutableStateOf("") }
    var detailTracks by remember { mutableStateOf<List<Track>>(emptyList()) }

    LaunchedEffect(hasAudioPermission) {
        if (hasAudioPermission && tracks.isEmpty()) viewModel.scan()
    }

    if (pendingAddTrack != null) {
        val track = pendingAddTrack!!
        AlertDialog(
            onDismissRequest = { pendingAddTrack = null },
            title = { Text("Add to playlist") },
            text = {
                if (playlists.isEmpty()) Text("No playlists yet. Create one from the Playlists tab.")
                else LazyColumn {
                    items(playlists, key = { it.id }) { pl ->
                        ListItem(
                            headlineContent = { Text(pl.name) },
                            modifier = Modifier.fillMaxWidth(),
                            leadingContent = { Icon(Icons.Default.QueueMusic, null) },
                            trailingContent = {},
                            tonalElevation = 0.dp,
                            shadowElevation = 0.dp,
                            colors = ListItemDefaults.colors(containerColor = androidx.compose.ui.graphics.Color.Transparent),
                        )
                        TextButton(onClick = { viewModel.addToPlaylist(pl.id, track.id); pendingAddTrack = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Add to ${pl.name}")
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { pendingAddTrack = null }) { Text("Close") } }
        )
    }

    if (showNowPlaying) {
        NowPlayingScreen(
            state = playerState,
            onBack = { showNowPlaying = false },
            onPlayPause = { viewModel.player.togglePlayPause() },
            onNext = { viewModel.player.next() },
            onPrevious = { viewModel.player.previous() },
            onSeek = { viewModel.player.seekTo(it) },
            onToggleShuffle = { viewModel.player.toggleShuffle() },
            onCycleRepeat = { viewModel.player.cycleRepeatMode() },
            onSeekToIndex = { viewModel.player.seekToIndex(it) },
        )
        return
    }

    val navBackStack by nav.currentBackStackEntryAsState()
    val currentRoute = navBackStack?.destination?.route

    Scaffold(
        topBar = {
            if (currentRoute in bottomScreens.map { it.route }) {
                TopAppBar(
                    title = { Text("Aether") },
                    actions = {
                        IconButton(onClick = {
                            if (hasAudioPermission) viewModel.scan() else permissionLauncher.launch(audioPermissions())
                        }) { Icon(Icons.Default.Refresh, contentDescription = "Scan library") }
                    }
                )
            }
        },
        bottomBar = {
            Column {
                playerState.currentTrack?.let { track ->
                    MiniPlayer(
                        track = track,
                        isPlaying = playerState.isPlaying,
                        onPlayPause = { viewModel.player.togglePlayPause() },
                        onNext = { viewModel.player.next() },
                        onOpen = { showNowPlaying = true }
                    )
                }
                if (currentRoute in bottomScreens.map { it.route }) {
                    NavigationBar {
                        bottomScreens.forEach { screen ->
                            NavigationBarItem(
                                selected = currentRoute == screen.route,
                                onClick = {
                                    nav.navigate(screen.route) {
                                        popUpTo(Screen.Songs.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(screen.icon, contentDescription = screen.label) },
                                label = { Text(screen.label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            )
                        }
                    }
                }
            }
        }
    ) { padding ->
        if (!hasAudioPermission) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                    Icon(Icons.Default.LibraryMusic, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(64.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("Music access needed", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(8.dp))
                    Text("Aether scans audio on your device to build your library. Your files stay on your device.", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { permissionLauncher.launch(audioPermissions()) }) { Text("Grant access") }
                }
            }
            return@Scaffold
        }

        NavHost(navController = nav, startDestination = Screen.Songs.route, modifier = Modifier.padding(padding)) {
            composable(Screen.Songs.route) {
                SongsScreen(
                    tracks = tracks,
                    currentTrackId = playerState.currentTrack?.id,
                    favorites = favorites,
                    isScanning = isScanning,
                    onPlay = { t, q -> viewModel.playTrack(t, q) },
                    onToggleFavorite = { viewModel.toggleFavorite(it) },
                    onAddToPlaylist = { pendingAddTrack = it }
                )
            }
            composable(Screen.Albums.route) {
                AlbumsScreen(tracks = tracks, onOpenAlbum = { name, list ->
                    detailTitle = name; detailSubtitle = "${list.size} songs"; detailTracks = list
                    nav.navigate("detail")
                })
            }
            composable(Screen.Artists.route) {
                ArtistsScreen(tracks = tracks, onOpenArtist = { name, list ->
                    detailTitle = name; detailSubtitle = "${list.size} songs"; detailTracks = list
                    nav.navigate("detail")
                })
            }
            composable(Screen.Playlists.route) {
                PlaylistsScreen(
                    playlists = playlists,
                    favoritesCount = favorites.size,
                    onCreate = { viewModel.createPlaylist(it) },
                    onOpen = { pl ->
                        detailTitle = pl.name; detailSubtitle = "${pl.trackIds.size} songs"; detailTracks = viewModel.tracksForIds(pl.trackIds)
                        nav.navigate("detail")
                    },
                    onOpenFavorites = {
                        val favTracks = tracks.filter { it.id in favorites }
                        detailTitle = "Favorites"; detailSubtitle = "${favTracks.size} songs"; detailTracks = favTracks
                        nav.navigate("detail")
                    },
                    onDelete = { viewModel.deletePlaylist(it) }
                )
            }
            composable(Screen.Search.route) {
                SearchScreen(
                    query = ui.query,
                    tracks = filtered,
                    currentTrackId = playerState.currentTrack?.id,
                    onQueryChange = { viewModel.setQuery(it) },
                    onPlay = { t, q -> viewModel.playTrack(t, q) }
                )
            }
            composable("detail") {
                TrackCollectionScreen(
                    title = detailTitle,
                    subtitle = detailSubtitle,
                    tracks = detailTracks,
                    currentTrackId = playerState.currentTrack?.id,
                    onBack = { nav.popBackStack() },
                    onPlay = { t, q -> viewModel.playTrack(t, q) }
                )
            }
        }
    }
}

@Composable
private fun SearchScreen(
    query: String,
    tracks: List<Track>,
    currentTrackId: Long?,
    onQueryChange: (String) -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Search songs, artists, albums") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true
        )
        if (query.isBlank()) {
            EmptyState("Search your library", "Type to find songs, artists, and albums.")
        } else if (tracks.isEmpty()) {
            EmptyState("No results", "Try a different search.")
        } else {
            LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, start = 8.dp, end = 8.dp)) {
                items(tracks, key = { it.id }) { track ->
                    TrackRow(track = track, isActive = track.id == currentTrackId, onClick = { onPlay(track, tracks) })
                }
            }
        }
    }
}

private fun audioPermissions(): Array<String> =
    if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.READ_MEDIA_AUDIO)
    else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

private fun hasAudioPermission(context: android.content.Context): Boolean =
    audioPermissions().all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
