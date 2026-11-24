package com.aether.audio.player.ui.theme

import android.app.Activity
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

object AetherColors {
    val Background = Color(0xFF111214)
    val Surface = Color(0xFF18191C)
    val Surface2 = Color(0xFF151618)
    val Surface3 = Color(0xFF1E1F23)
    val Accent = Color(0xFFE5A68C)
    val AccentDim = Color(0x26E5A68C)
    val Text = Color(0xFFEDEDEE)
    val Muted = Color(0xFF83848C)
    val Muted2 = Color(0xFF696A72)
    val Line = Color(0x14FFFFFF)
    val LineStrong = Color(0x26FFFFFF)
}

private val AetherDarkScheme = darkColorScheme(
    primary = AetherColors.Accent,
    onPrimary = Color(0xFF1A120D),
    primaryContainer = Color(0xFF3A2820),
    onPrimaryContainer = Color(0xFFF6E1D7),
    secondary = Color(0xFFCCBCA8),
    onSecondary = Color(0xFF1F1A14),
    background = AetherColors.Background,
    onBackground = AetherColors.Text,
    surface = AetherColors.Surface,
    onSurface = AetherColors.Text,
    surfaceVariant = AetherColors.Surface3,
    onSurfaceVariant = AetherColors.Muted,
    outline = Color(0xFF5A5248),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
)

@Composable
fun AetherTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = AetherColors.Background.toArgb()
            window.navigationBarColor = AetherColors.Background.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }
    MaterialTheme(
        colorScheme = AetherDarkScheme,
        typography = Typography(),
        content = content
    )
}
