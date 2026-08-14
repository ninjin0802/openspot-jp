package io.github.ninjin0802.openspotjp.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF006C4C),
    secondary = Color(0xFF4D6357),
    tertiary = Color(0xFF3D6373),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF55DBA5),
    secondary = Color(0xFFB4CCBE),
    tertiary = Color(0xFFA5CDDE),
)

@Composable
fun OpenSpotTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
