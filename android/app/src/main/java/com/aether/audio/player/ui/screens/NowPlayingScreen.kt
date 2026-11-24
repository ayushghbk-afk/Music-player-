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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import coil.compose.AsyncImage
import com.aether.audio.player.player.PlayerUiState
import com.aether.audio.player.ui.components.TrackRow
import com.aether.audio.player.ui.components.formatDuration

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
        Scaffold(topBar = {
            TopAppBar(
                title = { Text("Queue") },
                navigationIcon = { IconButton(onClick = { showQueue = false }) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") } }
            )
        }) { padding ->
            LazyColumn(modifier = Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(8.dp)) {
                itemsIndexed(state.queue, key = { idx, t -> "${t.id}-$idx" }) { index, qTrack ->
                    TrackRow(
                        track = qTrack,
                        isActive = index == state.currentIndex,
                        onClick = { onSeekToIndex(index) }
                    )
                }
            }
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Now Playing", maxLines = 1) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Close") } },
                actions = { IconButton(onClick = { showQueue = true }) { Icon(Icons.Default.QueueMusic, contentDescription = "Queue") } }
            )
        }
    ) { padding ->
        if (track == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Nothing playing", style = MaterialTheme.typography.bodyLarge)
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
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
                AsyncImage(
                    model = track.artworkUri,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Icon(Icons.Default.MusicNote, null, tint = Color(0x44D4A574), modifier = Modifier.size(72.dp))
            }

            Spacer(Modifier.height(24.dp))
            Text(track.title, style = MaterialTheme.typography.headlineSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Text(track.displayArtist, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(track.displayAlbum, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)

            Spacer(Modifier.height(20.dp))
            val duration = state.durationMs.coerceAtLeast(1L)
            var sliderPos by remember(state.currentTrack?.id) { mutableFloatStateOf(0f) }
            var dragging by remember { mutableStateOf(false) }
            val displayPos = if (dragging) (sliderPos * duration).toLong() else state.positionMs.coerceIn(0L, duration)
            Slider(
                value = (displayPos.toFloat() / duration.toFloat()).coerceIn(0f, 1f),
                onValueChange = { dragging = true; sliderPos = it },
                onValueChangeFinished = { dragging = false; onSeek((sliderPos * duration).toLong()) },
                modifier = Modifier.fillMaxWidth()
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatDuration(displayPos), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(formatDuration(duration), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onToggleShuffle) {
                    Icon(Icons.Default.Shuffle, contentDescription = "Shuffle", tint = if (state.shuffleEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onPrevious, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(32.dp))
                }
                FilledIconButton(
                    onClick = onPlayPause,
                    modifier = Modifier.size(72.dp),
                    shape = CircleShape
                ) {
                    if (state.isBuffering) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(
                            if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (state.isPlaying) "Pause" else "Play",
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
                IconButton(onClick = onNext, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Default.SkipNext, contentDescription = "Next", modifier = Modifier.size(32.dp))
                }
                IconButton(onClick = onCycleRepeat) {
                    val repeatIcon = when (state.repeatMode) {
                        Player.REPEAT_MODE_ONE -> Icons.Default.RepeatOne
                        else -> Icons.Default.Repeat
                    }
                    val tint = if (state.repeatMode != Player.REPEAT_MODE_OFF) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    Icon(repeatIcon, contentDescription = "Repeat", tint = tint)
                }
            }
        }
    }
}
