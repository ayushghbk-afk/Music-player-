package com.aether.audio.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
import coil.compose.AsyncImage
import com.aether.audio.player.model.Track
import com.aether.audio.player.ui.theme.AetherColors

fun formatDuration(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

@Composable
fun TrackArtwork(uri: String, modifier: Modifier = Modifier, radius: Int = 10) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(radius.dp))
            .background(AetherColors.Surface3),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            Icons.Default.MusicNote,
            contentDescription = null,
            tint = AetherColors.Accent.copy(alpha = 0.35f),
            modifier = Modifier.size(20.dp)
        )
        AsyncImage(
            model = uri,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
    }
}

@Composable
fun TrackRow(
    track: Track,
    isActive: Boolean,
    isPlaying: Boolean = false,
    onClick: () -> Unit,
    trailing: @Composable (() -> Unit)? = null,
) {
    val bg = if (isActive) AetherColors.Accent.copy(alpha = 0.08f) else Color.Transparent
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
            TrackArtwork(track.artworkUri, Modifier.fillMaxSize())
            if (isActive && isPlaying) {
                Box(
                    Modifier.fillMaxSize().background(Color(0x66000000), RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.GraphicEq, contentDescription = null, tint = AetherColors.Accent, modifier = Modifier.size(20.dp))
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                track.title,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Medium),
                color = if (isActive) AetherColors.Accent else AetherColors.Text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Text(
                "${track.displayArtist}  •  ${track.displayAlbum}",
                style = MaterialTheme.typography.bodySmall,
                color = AetherColors.Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(8.dp))
        if (trailing != null) trailing() else Text(
            formatDuration(track.durationMs),
            style = MaterialTheme.typography.labelSmall,
            color = AetherColors.Muted2
        )
    }
}

@Composable
fun MiniPlayer(
    track: Track,
    isPlaying: Boolean,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 6.dp)
            .clickable(onClick = onOpen),
        shape = RoundedCornerShape(16.dp),
        color = AetherColors.Surface2,
        tonalElevation = 0.dp,
        shadowElevation = 10.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, AetherColors.Line)
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TrackArtwork(track.artworkUri, Modifier.size(46.dp), radius = 8)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
                Text(track.displayArtist, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = AetherColors.Muted)
            }
            IconButton(onClick = onPlayPause) {
                Icon(if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = if (isPlaying) "Pause" else "Play", tint = AetherColors.Text)
            }
            IconButton(onClick = onNext) {
                Icon(Icons.Default.SkipNext, contentDescription = "Next", tint = AetherColors.Muted)
            }
        }
    }
}

@Composable
fun EmptyState(title: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier.size(72.dp).background(AetherColors.Accent.copy(alpha = 0.08f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.MusicNote, contentDescription = null, tint = AetherColors.Accent.copy(alpha = 0.6f), modifier = Modifier.size(32.dp))
        }
        Spacer(Modifier.height(14.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, color = AetherColors.Text)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = AetherColors.Muted)
    }
}

@Composable
fun SectionHeader(title: String, subtitle: String? = null) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
        if (subtitle != null) {
            Text(subtitle.uppercase(), style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.6.sp), color = AetherColors.Muted2)
            Spacer(Modifier.height(4.dp))
        }
        Text(title, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold), color = AetherColors.Text)
    }
}
