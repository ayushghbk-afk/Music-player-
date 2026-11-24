package com.aether.audio.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
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
    onBack: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSeek: (Long) -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onSeekToIndex: (Int) -> Unit,
) {
    val track = state.currentTrack
    var showQueue by remember { mutableStateOf(false) }

    if (showQueue) {
        Scaffold(
            containerColor = AetherColors.Background,
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
                    title = { Text("Queue", color = AetherColors.Text) },
                    navigationIcon = { IconButton(onClick = { showQueue = false }) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = AetherColors.Text) } }
                )
            }
        ) { padding ->
            LazyColumn(modifier = Modifier.padding(padding).fillMaxSize().background(AetherColors.Background), contentPadding = PaddingValues(8.dp)) {
                itemsIndexed(state.queue, key = { idx, t -> "${t.id}-$idx" }) { index, qTrack ->
                    TrackRow(track = qTrack, isActive = index == state.currentIndex, isPlaying = index == state.currentIndex && state.isPlaying, onClick = { onSeekToIndex(index) })
                }
            }
        }
        return
    }

    Scaffold(
        containerColor = AetherColors.Background,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = AetherColors.Background),
                title = {
                    Column {
                        Text("THE LISTENING ROOM", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp), color = AetherColors.Muted2)
                        Text("Now Playing", color = AetherColors.Text, fontWeight = FontWeight.SemiBold)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Close", tint = AetherColors.Text) } },
                actions = { IconButton(onClick = { showQueue = true }) { Icon(Icons.Default.QueueMusic, contentDescription = "Queue", tint = AetherColors.Muted) } }
            )
        }
    ) { padding ->
        if (track == null) {
            Box(Modifier.fillMaxSize().padding(padding).background(AetherColors.Background), contentAlignment = Alignment.Center) {
                Text("Nothing playing", style = MaterialTheme.typography.bodyLarge, color = AetherColors.Muted)
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Brush.verticalGradient(listOf(AetherColors.Background, Color(0xFF161210), AetherColors.Background)))
                .padding(horizontal = 24.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF2A2118), Color(0xFF151515)))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.MusicNote, null, tint = AetherColors.Accent.copy(alpha = 0.2f), modifier = Modifier.size(72.dp))
                AsyncImage(model = track.artworkUri, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }

            Spacer(Modifier.height(24.dp))
            Text(if (state.isPlaying) "LET THE WORLD WAIT" else "TAKE A MOMENT", style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.5.sp), color = AetherColors.Muted2)
            Spacer(Modifier.height(8.dp))
            Text(track.title, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis, color = AetherColors.Text)
            Spacer(Modifier.height(4.dp))
            Text(track.displayArtist, style = MaterialTheme.typography.bodyLarge, color = AetherColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(track.displayAlbum, style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted2, maxLines = 1, overflow = TextOverflow.Ellipsis)

            Spacer(Modifier.height(20.dp))
            val duration = state.durationMs.coerceAtLeast(1L)
            var sliderPos by remember(state.currentTrack?.id) { mutableFloatStateOf(0f) }
            var dragging by remember { mutableStateOf(false) }
            val displayPos = if (dragging) (sliderPos * duration).toLong() else state.positionMs.coerceIn(0L, duration)
            Slider(
                value = (displayPos.toFloat() / duration.toFloat()).coerceIn(0f, 1f),
                onValueChange = { dragging = true; sliderPos = it },
                onValueChangeFinished = { dragging = false; onSeek((sliderPos * duration).toLong()) },
                modifier = Modifier.fillMaxWidth(),
                colors = SliderDefaults.colors(thumbColor = AetherColors.Accent, activeTrackColor = AetherColors.Accent, inactiveTrackColor = AetherColors.LineStrong)
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatDuration(displayPos), style = MaterialTheme.typography.labelSmall, color = AetherColors.Muted2)
                Text(formatDuration(duration), style = MaterialTheme.typography.labelSmall, color = AetherColors.Muted2)
            }

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onToggleShuffle) {
                    Icon(Icons.Default.Shuffle, contentDescription = "Shuffle", tint = if (state.shuffleEnabled) AetherColors.Accent else AetherColors.Muted)
                }
                IconButton(onClick = onPrevious, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(32.dp), tint = AetherColors.Text)
                }
                FilledIconButton(
                    onClick = onPlayPause,
                    modifier = Modifier.size(72.dp),
                    shape = CircleShape,
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = AetherColors.Accent, contentColor = Color(0xFF1A120D))
                ) {
                    if (state.isBuffering) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.dp, color = Color(0xFF1A120D))
                    } else {
                        Icon(if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = if (state.isPlaying) "Pause" else "Play", modifier = Modifier.size(36.dp))
                    }
                }
                IconButton(onClick = onNext, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipNext, contentDescription = "Next", modifier = Modifier.size(32.dp), tint = AetherColors.Text)
                }
                IconButton(onClick = onCycleRepeat) {
                    val repeatIcon = when (state.repeatMode) { Player.REPEAT_MODE_ONE -> Icons.Default.RepeatOne; else -> Icons.Default.Repeat }
                    Icon(repeatIcon, contentDescription = "Repeat", tint = if (state.repeatMode != Player.REPEAT_MODE_OFF) AetherColors.Accent else AetherColors.Muted)
                }
            }
        }
    }
}
