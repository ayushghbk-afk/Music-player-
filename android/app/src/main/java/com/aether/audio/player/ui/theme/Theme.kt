package com.aether.audio.player.ui.theme

import android.app.Activity
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val AetherDarkScheme = darkColorScheme(
    primary = Color(0xFFD4A574),
    onPrimary = Color(0xFF1A1208),
    primaryContainer = Color(0xFF3A2A18),
    onPrimaryContainer = Color(0xFFF3DFC8),
    secondary = Color(0xFFCCBCA8),
    onSecondary = Color(0xFF1F1A14),
    background = Color(0xFF0B0B0B),
    onBackground = Color(0xFFF3EFE8),
    surface = Color(0xFF141414),
    onSurface = Color(0xFFF3EFE8),
    surfaceVariant = Color(0xFF1E1B18),
    onSurfaceVariant = Color(0xFFD2C8BC),
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
            window.statusBarColor = Color(0xFF0B0B0B).toArgb()
            window.navigationBarColor = Color(0xFF0B0B0B).toArgb()
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
