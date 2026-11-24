package com.aether.audio.player

import android.app.Application
import com.aether.audio.player.model.MusicRepository
import com.aether.audio.player.player.PlayerController

class AetherApp : Application() {
    lateinit var repository: MusicRepository
        private set
    lateinit var playerController: PlayerController
        private set

    override fun onCreate() {
        super.onCreate()
        repository = MusicRepository(this)
        playerController = PlayerController(this)
        playerController.setTrackResolver { mediaId ->
            mediaId.toLongOrNull()?.let { id -> repository.tracks.value.find { it.id == id } }
        }
    }
}
