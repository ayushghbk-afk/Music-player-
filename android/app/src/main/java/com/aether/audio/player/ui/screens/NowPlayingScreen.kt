package com.aether.audio.player.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import coil.compose.AsyncImage
import com.aether.audio.player.player.PlayerUiState
import com.aether.audio.player.ui.components.TrackRow
import com.aether.audio.player.ui.components.formatDuration
import com.aether.audio.player.ui.theme.AetherColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NowPlayingScreen(
    state: PlayerUiState,
    lyrics: String = "",
    onBack: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onSeekToIndex: (Int) -> Unit,
    onSaveLyrics: (String) -> Unit = {},
) {
    val track = state.currentTrack
    var showQueue by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf("visualizer") }

    if (showQueue) {
        Scaffold(containerColor = AetherColors.Background, topBar = {
            TopAppBar(colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
                title = { Text("Queue", color = AetherColors.Text) },
                navigationIcon = { IconButton(onClick = { showQueue = false }) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = AetherColors.Text) } })
        }) { padding ->
            LazyColumn(modifier = Modifier.padding(padding).fillMaxSize().background(AetherColors.Background), contentPadding = PaddingValues(8.dp)) {
                itemsIndexed(state.queue, key = { idx, t -> "${t.id}-$idx" }) { index, qTrack ->
                    TrackRow(track = qTrack, isActive = index == state.currentIndex, isPlaying = index == state.currentIndex && state.isPlaying, onClick = { onSeekToIndex(index) })
                }
            }
        }
        return
    }

    Scaffold(containerColor = AetherColors.Background, topBar = {
        TopAppBar(colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
            title = { Column { Text("THE LISTENING ROOM", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Muted2); Text("Now Playing", color = AetherColors.Text, fontWeight = FontWeight.SemiBold) } },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Close", tint = AetherColors.Text) } },
            actions = { IconButton(onClick = { showQueue = true }) { Icon(Icons.Default.QueueMusic, contentDescription = "Queue", tint = AetherColors.Muted) } })
    }) { padding ->
        if (track == null) {
            Box(Modifier.fillMaxSize().padding(padding).background(AetherColors.Background), contentAlignment = Alignment.Center) { Text("Nothing playing", style = MaterialTheme.typography.bodyLarge, color = AetherColors.Muted) }
            return@Scaffold
        }
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).background(Brush.verticalGradient(listOf(AetherColors.Background, Color(0xFF161210), AetherColors.Background))).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Color(0xFF2A2118), Color(0xFF151515)))), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.MusicNote, null, tint = AetherColors.Accent.copy(alpha = 0.2f), modifier = Modifier.size(72.dp))
                AsyncImage(model = track.artworkUri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
            Spacer(Modifier.height(18.dp))
            Text(if (state.isPlaying) "LET THE WORLD WAIT" else "TAKE A MOMENT", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.5.sp), color = AetherColors.Muted2)
            Spacer(Modifier.height(6.dp))
            Text(track.title, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis, color = AetherColors.Text)
            Text(track.displayArtist, style = MaterialTheme.typography.bodyLarge, color = AetherColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(track.displayAlbum, style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(AetherColors.Surface), horizontalArrangement = Arrangement.SpaceEvenly) {
                listOf("visualizer" to "Visualizer", "lyrics" to "Lyrics", "specs" to "Details").forEach { (k, l) ->
                    TextButton(onClick = { tab = k }, colors = ButtonDefaults.textButtonColors(contentColor = if (tab == k) AetherColors.Accent else AetherColors.Muted)) { Text(l) }
                }
            }
            Spacer(Modifier.height(10.dp))
            when (tab) {
                "visualizer" -> VisualizerCard(state.isPlaying)
                "lyrics" -> LyricsCard(lyrics, onSaveLyrics)
                else -> SpecsCard(track)
            }
            Spacer(Modifier.height(12.dp))
            val duration = state.durationMs.coerceAtLeast(1L)
            var sliderPos by remember(state.currentTrack?.id) { mutableFloatStateOf(0f) }
            var dragging by remember { mutableStateOf(false) }
            val displayPos = if (dragging) (sliderPos * duration).toLong() else state.positionMs.coerceIn(0L, duration)
            Slider(value = (displayPos.toFloat() / duration.toFloat()).coerceIn(0f, 1f), onValueChange = { dragging = true; sliderPos = it }, onValueChangeFinished = { dragging = false; onSeek((sliderPos * duration).toLong()) },
                colors = SliderDefaults.colors(thumbColor = AetherColors.Accent, activeTrackColor = AetherColors.Accent, inactiveTrackColor = AetherColors.LineStrong))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatDuration(displayPos), style = MaterialTheme.typography.labelSmall, color = AetherColors.Muted2)
                Text(formatDuration(duration), style = MaterialTheme.typography.labelSmall, color = AetherColors.Muted2)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onToggleShuffle) { Icon(Icons.Default.Shuffle, contentDescription = "Shuffle", tint = if (state.shuffleEnabled) AetherColors.Accent else AetherColors.Muted) }
                IconButton(onClick = onPrevious, modifier = Modifier.size(48.dp)) { Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(32.dp), tint = AetherColors.Text) }
                FilledIconButton(onClick = onPlayPause, modifier = Modifier.size(72.dp), shape = CircleShape, colors = IconButtonDefaults.filledIconButtonColors(containerColor = AetherColors.Accent, contentColor = Color(0xFF1A120D))) {
                    if (state.isBuffering) CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.dp, color = Color(0xFF1A120D))
                    else Icon(if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = if (state.isPlaying) "Pause" else "Play", modifier = Modifier.size(36.dp))
                }
                IconButton(onClick = onNext, modifier = Modifier.size(48.dp)) { Icon(Icons.Default.SkipNext, contentDescription = "Next", modifier = Modifier.size(32.dp), tint = AetherColors.Text) }
                IconButton(onClick = onCycleRepeat) { Icon(if (state.repeatMode == Player.REPEAT_MODE_ONE) Icons.Default.RepeatOne else Icons.Default.Repeat, contentDescription = "Repeat", tint = if (state.repeatMode != Player.REPEAT_MODE_OFF) AetherColors.Accent else AetherColors.Muted) }
            }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun VisualizerCard(isPlaying: Boolean) {
    val transition = rememberInfiniteTransition(label = "viz")
    val bars = List(12) { i ->
        transition.animateFloat(0.2f, 1f, infiniteRepeatable(tween(500 + i * 60, easing = LinearEasing), RepeatMode.Reverse), label = "b$i").value
    }
    Surface(color = AetherColors.Surface, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("LIVE VISUALIZER", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Muted2)
            Spacer(Modifier.height(12.dp))
            Row(Modifier.height(72.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                bars.forEach { v ->
                    val h = if (isPlaying) (18 + 54 * v).dp else 12.dp
                    Box(Modifier.width(8.dp).height(h).clip(RoundedCornerShape(4.dp)).background(AetherColors.Accent.copy(alpha = 0.85f)))
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(if (isPlaying) "Native playback active" else "Paused", color = AetherColors.Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun LyricsCard(lyrics: String, onSaveLyrics: (String) -> Unit) {
    var editing by remember(lyrics) { mutableStateOf(false) }
    var draft by remember(lyrics) { mutableStateOf(lyrics) }
    Surface(color = AetherColors.Surface, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("LYRICS", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Muted2, modifier = Modifier.weight(1f))
                TextButton(onClick = { if (editing) { onSaveLyrics(draft); editing = false } else editing = true }) { Text(if (editing) "Save" else "Edit", color = AetherColors.Accent) }
            }
            if (editing) {
                OutlinedTextField(value = draft, onValueChange = { draft = it }, modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp), colors = OutlinedTextFieldDefaults.colors(focusedTextColor = AetherColors.Text, unfocusedTextColor = AetherColors.Text, focusedBorderColor = AetherColors.Accent))
            } else {
                Text(if (lyrics.isBlank()) "No lyrics yet. Tap Edit to add lyrics for this track." else lyrics, color = if (lyrics.isBlank()) AetherColors.Muted else AetherColors.Text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun SpecsCard(track: com.aether.audio.player.model.Track) {
    Surface(color = AetherColors.Surface, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("RECORDING DETAILS", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Muted2)
            SpecRow("Title", track.title)
            SpecRow("Artist", track.displayArtist)
            SpecRow("Album", track.displayAlbum)
            SpecRow("Format", track.mimeType.ifBlank { "Unknown" })
            SpecRow("Duration", formatDuration(track.durationMs))
            SpecRow("Size", if (track.size > 0) String.format("%.1f MB", track.size / 1048576f) else "Unknown")
        }
    }
}

@Composable
private fun SpecRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = AetherColors.Muted2, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.width(12.dp))
        Text(value, color = AetherColors.Text, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
