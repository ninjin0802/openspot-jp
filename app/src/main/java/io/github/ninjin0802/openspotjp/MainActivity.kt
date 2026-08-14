package io.github.ninjin0802.openspotjp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.ninjin0802.openspotjp.ui.OpenSpotApp
import io.github.ninjin0802.openspotjp.ui.theme.OpenSpotTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            OpenSpotTheme {
                OpenSpotApp((application as OpenSpotApplication).container)
            }
        }
    }
}
