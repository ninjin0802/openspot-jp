package io.github.ninjin0802.openspotjp

import android.app.Application
import io.github.ninjin0802.openspotjp.data.AppContainer

class OpenSpotApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}
