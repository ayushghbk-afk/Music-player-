package com.aether.audio.player.model

enum class AppTheme(val key: String, val label: String) {
    OBSIDIAN("obsidian", "Copper"),
    SAPPHIRE("sapphire", "Sapphire"),
    CYBERPUNK("cyberpunk", "Rose"),
    STUDIO_GOLD("studio-gold", "Gold"),
    SLATE("slate", "Sage");

    companion object { fun fromKey(key: String) = entries.find { it.key == key } ?: OBSIDIAN }
}

data class EqSettings(
    val enabled: Boolean = true,
    val preset: String = "Audiophile Neutral",
    val bands: List<Float> = List(10) { 0f },
    val preamp: Float = 0f,
    val bassBoost: Float = 0f,
    val trebleBoost: Float = 0f,
)

data class AppSettings(
    val theme: String = AppTheme.OBSIDIAN.key,
    val autoPlayNext: Boolean = true,
    val gapless: Boolean = true,
    val crossfadeSec: Int = 0,
    val visualizerMode: String = "bars",
)
