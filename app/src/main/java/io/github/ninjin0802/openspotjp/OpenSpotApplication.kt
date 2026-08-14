package io.github.ninjin0802.openspotjp

import android.app.Application
import io.github.ninjin0802.openspotjp.data.AppContainer
import org.maplibre.android.MapLibre

class OpenSpotApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        MapLibre.getInstance(this)
    }
}
