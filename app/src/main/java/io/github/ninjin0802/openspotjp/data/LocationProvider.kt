package io.github.ninjin0802.openspotjp.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.core.util.Consumer
import kotlinx.coroutines.suspendCancellableCoroutine

data class UserLocation(val latitude: Double, val longitude: Double, val accuracy: Float)

class LocationProvider(private val context: Context) {
    private val manager = context.getSystemService(LocationManager::class.java)

    suspend fun currentLocation(): UserLocation? {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return null

        val provider = when {
            fine && manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> return null
        }
        return suspendCancellableCoroutine { continuation ->
            val signal = CancellationSignal()
            LocationManagerCompat.getCurrentLocation(
                manager,
                provider,
                signal,
                ContextCompat.getMainExecutor(context),
                Consumer<Location> { location ->
                    val value = location.let { UserLocation(it.latitude, it.longitude, it.accuracy) }
                    continuation.resume(value) { _, _, _ -> }
                },
            )
            continuation.invokeOnCancellation { signal.cancel() }
        }
    }
}
