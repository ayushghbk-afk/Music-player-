package com.aether.audio.player.ui.theme

import android.app.Activity
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

data class AetherPalette(
    val accent: Color,
    val accentDim: Color,
    val background: Color = Color(0xFF111214),
    val surface: Color = Color(0xFF18191C),
    val surface2: Color = Color(0xFF151618),
    val surface3: Color = Color(0xFF1E1F23),
    val text: Color = Color(0xFFEDEDEE),
    val muted: Color = Color(0xFF83848C),
    val muted2: Color = Color(0xFF696A72),
    val line: Color = Color(0x14FFFFFF),
    val lineStrong: Color = Color(0x26FFFFFF),
)

val ObsidianPalette = AetherPalette(accent = Color(0xFFE5A68C), accentDim = Color(0x26E5A68C))
val SapphirePalette = AetherPalette(accent = Color(0xFFA4B9EB), accentDim = Color(0x26A4B9EB))
val CyberpunkPalette = AetherPalette(accent = Color(0xFFE9A5C4), accentDim = Color(0x26E9A5C4))
val StudioGoldPalette = AetherPalette(accent = Color(0xFFD6B87D), accentDim = Color(0x26D6B87D))
val SlatePalette = AetherPalette(accent = Color(0xFF9FC7B9), accentDim = Color(0x269FC7B9))

fun paletteFor(key: String): AetherPalette = when (key) {
    "sapphire" -> SapphirePalette
    "cyberpunk" -> CyberpunkPalette
    "studio-gold" -> StudioGoldPalette
    "slate" -> SlatePalette
    else -> ObsidianPalette
}

val LocalAetherPalette = staticCompositionLocalOf { ObsidianPalette }

object AetherColors {
    val Accent @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.accent
    val AccentDim @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.accentDim
    val Background @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.background
    val Surface @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.surface
    val Surface2 @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.surface2
    val Surface3 @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.surface3
    val Text @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.text
    val Muted @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.muted
    val Muted2 @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.muted2
    val Line @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.line
    val LineStrong @Composable @ReadOnlyComposable get() = LocalAetherPalette.current.lineStrong
}

@Composable
fun AetherTheme(themeKey: String = "obsidian", content: @Composable () -> Unit) {
    val palette = paletteFor(themeKey)
    val scheme = darkColorScheme(
        primary = palette.accent,
        onPrimary = Color(0xFF1A120D),
        primaryContainer = palette.accent.copy(alpha = 0.2f),
        onPrimaryContainer = palette.text,
        secondary = Color(0xFFCCBCA8),
        background = palette.background,
        onBackground = palette.text,
        surface = palette.surface,
        onSurface = palette.text,
        surfaceVariant = palette.surface3,
        onSurfaceVariant = palette.muted,
        outline = palette.muted2,
    )
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = palette.background.toArgb()
            window.navigationBarColor = palette.background.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }
    CompositionLocalProvider(LocalAetherPalette provides palette) {
        MaterialTheme(colorScheme = scheme, typography = Typography(), content = content)
    }
}
