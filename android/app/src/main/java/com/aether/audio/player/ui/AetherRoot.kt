package com.aether.audio.player.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aether.audio.player.model.Track
import com.aether.audio.player.ui.components.*
import com.aether.audio.player.ui.screens.*
import com.aether.audio.player.ui.theme.AetherColors

private data class NavItem(val route: String, val label: String, val icon: ImageVector, val selectedIcon: ImageVector = icon)

private val bottomItems = listOf(
    NavItem("songs", "Library", Icons.Outlined.LibraryMusic, Icons.Filled.LibraryMusic),
    NavItem("albums", "Albums", Icons.Outlined.Album, Icons.Filled.Album),
    NavItem("playlists", "Playlists", Icons.Outlined.QueueMusic, Icons.Filled.QueueMusic),
    NavItem("studio", "Studio", Icons.Outlined.Tune, Icons.Filled.Tune),
)

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

    var hasAudioPermission by remember { mutableStateOf(hasAudioPermission(context)) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        hasAudioPermission = hasAudioPermission(context)
        if (hasAudioPermission) viewModel.scan()
    }

    var pendingAddTrack by remember { mutableStateOf<Track?>(null) }
    var showNowPlaying by remember { mutableStateOf(false) }
    var showMore by remember { mutableStateOf(false) }
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
            containerColor = AetherColors.Surface,
            title = { Text("Add to playlist", color = AetherColors.Text) },
            text = {
                if (playlists.isEmpty()) Text("No playlists yet. Create one from the Playlists tab.", color = AetherColors.Muted)
                else LazyColumn {
                    items(playlists, key = { it.id }) { pl ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable {
                                viewModel.addToPlaylist(pl.id, track.id); pendingAddTrack = null
                            }.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.QueueMusic, null, tint = AetherColors.Accent)
                            Spacer(Modifier.width(12.dp))
                            Text(pl.name, color = AetherColors.Text)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { pendingAddTrack = null }) { Text("Close") } }
        )
    }

    if (showMore) {
        MoreSheet(
            totalTracks = tracks.size,
            hiResCount = tracks.count { it.mimeType.contains("flac", true) || it.mimeType.contains("wav", true) },
            onDismiss = { showMore = false },
            onScan = { if (hasAudioPermission) viewModel.scan() else permissionLauncher.launch(audioPermissions()) },
            onOpenSearch = { showMore = false; nav.navigate("search") { launchSingleTop = true } }
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
    val showChrome = currentRoute in bottomItems.map { it.route } || currentRoute == "search"

    Scaffold(
        containerColor = AetherColors.Background,
        topBar = {
            if (showChrome) {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background, titleContentColor = AetherColors.Text),
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.GraphicEq, contentDescription = null, tint = AetherColors.Accent, modifier = Modifier.size(22.dp))
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text("aether", fontWeight = FontWeight.SemiBold, fontSize = 24.sp, letterSpacing = (-0.8).sp)
                                Text("THE ART OF LISTENING", style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp, letterSpacing = 1.8.sp), color = AetherColors.Muted2)
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = { nav.navigate("search") { launchSingleTop = true } }) { Icon(Icons.Default.Search, contentDescription = "Search", tint = AetherColors.Muted) }
                        IconButton(onClick = {
                            if (hasAudioPermission) viewModel.scan() else permissionLauncher.launch(audioPermissions())
                        }) { Icon(Icons.Default.Refresh, contentDescription = "Scan library", tint = AetherColors.Muted) }
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
                if (showChrome) {
                    NavigationBar(containerColor = AetherColors.Surface2, tonalElevation = 0.dp) {
                        bottomItems.forEach { item ->
                            val selected = currentRoute == item.route
                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    nav.navigate(item.route) {
                                        popUpTo("songs") { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(if (selected) item.selectedIcon else item.icon, contentDescription = item.label) },
                                label = { Text(item.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = AetherColors.Accent,
                                    selectedTextColor = AetherColors.Accent,
                                    indicatorColor = AetherColors.Accent.copy(alpha = 0.12f),
                                    unselectedIconColor = AetherColors.Muted,
                                    unselectedTextColor = AetherColors.Muted,
                                )
                            )
                        }
                        val moreSelected = false
                        NavigationBarItem(
                            selected = moreSelected,
                            onClick = { showMore = true },
                            icon = { Icon(Icons.Default.MoreHoriz, contentDescription = "More") },
                            label = { Text("More") },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = AetherColors.Accent,
                                selectedTextColor = AetherColors.Accent,
                                indicatorColor = AetherColors.Accent.copy(alpha = 0.12f),
                                unselectedIconColor = AetherColors.Muted,
                                unselectedTextColor = AetherColors.Muted,
                            )
                        )
                    }
                }
            }
        }
    ) { padding ->
        if (!hasAudioPermission) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(28.dp)) {
                    Box(Modifier.size(80.dp).background(AetherColors.Accent.copy(alpha = 0.1f), CircleShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.LibraryMusic, null, tint = AetherColors.Accent, modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    Text("Music access needed", style = MaterialTheme.typography.headlineSmall, color = AetherColors.Text)
                    Spacer(Modifier.height(8.dp))
                    Text("Aether scans audio on your device to build your library. Your files stay on your device.", style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted)
                    Spacer(Modifier.height(20.dp))
                    Button(onClick = { permissionLauncher.launch(audioPermissions()) }, colors = ButtonDefaults.buttonColors(containerColor = AetherColors.Accent, contentColor = Color(0xFF1A120D))) { Text("Grant access") }
                }
            }
            return@Scaffold
        }

        NavHost(navController = nav, startDestination = "songs", modifier = Modifier.padding(padding)) {
            composable("songs") {
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
            composable("albums") {
                AlbumsScreen(tracks = tracks, onOpenAlbum = { name, list ->
                    detailTitle = name; detailSubtitle = "${list.size} songs"; detailTracks = list
                    nav.navigate("detail")
                })
            }
            composable("playlists") {
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
            composable("studio") {
                StudioScreen()
            }
            composable("search") {
                SearchScreen(
                    query = ui.query,
                    tracks = filtered,
                    currentTrackId = playerState.currentTrack?.id,
                    onQueryChange = { viewModel.setQuery(it) },
                    onPlay = { t, q -> viewModel.playTrack(t, q) },
                    onBack = { nav.popBackStack() }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoreSheet(totalTracks: Int, hiResCount: Int, onDismiss: () -> Unit, onScan: () -> Unit, onOpenSearch: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AetherColors.Surface) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
            Text("MAKE IT YOURS", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp), color = AetherColors.Muted2)
            Spacer(Modifier.height(4.dp))
            Text("Your listening space.", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
            Spacer(Modifier.height(16.dp))
            MoreRow(Icons.Default.Refresh, "Scan library", "Find music on this device", onScan)
            MoreRow(Icons.Default.Search, "Search", "Find songs, artists, albums", onOpenSearch)
            MoreRow(Icons.Default.HighQuality, "Hi-res collection", "$hiResCount high quality files detected") {}
            MoreRow(Icons.Default.GraphicEq, "Sound studio", "Native playback is active") {}
            Spacer(Modifier.height(8.dp))
            Text("$totalTracks tracks on this device. Your music stays yours.", style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted2)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun MoreRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(40.dp).background(AetherColors.Accent.copy(alpha = 0.1f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = AetherColors.Accent, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = AetherColors.Text, fontWeight = FontWeight.Medium)
            Text(subtitle, color = AetherColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
        Icon(Icons.Default.ChevronRight, null, tint = AetherColors.Muted2)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchScreen(
    query: String,
    tracks: List<Track>,
    currentTrackId: Long?,
    onQueryChange: (String) -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(AetherColors.Background)) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
            title = { Text("Search", color = AetherColors.Text) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back", tint = AetherColors.Text) } }
        )
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Search your library", color = AetherColors.Muted2) },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = AetherColors.Muted) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AetherColors.Accent, unfocusedBorderColor = AetherColors.LineStrong,
                focusedTextColor = AetherColors.Text, unfocusedTextColor = AetherColors.Text,
                cursorColor = AetherColors.Accent
            )
        )
        if (query.isBlank()) {
            EmptyState("Search your library", "Type to find songs, artists, and albums.")
        } else if (tracks.isEmpty()) {
            EmptyState("No matches. Keep exploring.", "Try another title, album, or artist.")
        } else {
            LazyColumn(contentPadding = PaddingValues(bottom = 140.dp, start = 8.dp, end = 8.dp)) {
                items(tracks, key = { it.id }) { track ->
                    TrackRow(track = track, isActive = track.id == currentTrackId, isPlaying = track.id == currentTrackId, onClick = { onPlay(track, tracks) })
                }
            }
        }
    }
}

@Composable
private fun StudioScreen() {
    Column(Modifier.fillMaxSize().background(AetherColors.Background).padding(20.dp)) {
        Text("YOUR STUDIO", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp), color = AetherColors.Muted2)
        Spacer(Modifier.height(6.dp))
        Text("Sound studio", style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
        Spacer(Modifier.height(8.dp))
        Text("Native playback is active. Advanced EQ/studio controls are coming to the native UI in the next pass.", color = AetherColors.Muted)
        Spacer(Modifier.height(20.dp))
        Surface(color = AetherColors.Surface, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)) {
            Column(Modifier.padding(16.dp)) {
                Text("Native audio engine", color = AetherColors.Text, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(4.dp))
                Text("Playback uses Media3/ExoPlayer on device — no WebView audio.", color = AetherColors.Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

private fun audioPermissions(): Array<String> =
    if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.READ_MEDIA_AUDIO)
    else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

private fun hasAudioPermission(context: android.content.Context): Boolean =
    audioPermissions().all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
