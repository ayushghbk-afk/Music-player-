package com.aether.audio.player

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.aether.audio.player.ui.AetherRoot
import com.aether.audio.player.ui.MainViewModel
import com.aether.audio.player.ui.theme.AetherTheme
import kotlinx.coroutines.launch
import androidx.compose.runtime.getValue

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermissionIfNeeded()
        connectPlayer()
        setContent {
            val settings by viewModel.settings.collectAsStateWithLifecycle()
            AetherTheme(themeKey = settings.theme) {
                AetherRoot(viewModel = viewModel)
            }
        }
    }

    private fun connectPlayer() {
        val app = application as AetherApp
        lifecycleScope.launch { runCatching { app.playerController.connect() } }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            if (!granted) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
