package io.github.ninjin0802.openspotjp.data

import android.content.Context
import androidx.room.Room
import io.github.ninjin0802.openspotjp.data.local.FavoriteDatabase
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class AppContainer(context: Context) {
    private val database = Room.databaseBuilder(
        context.applicationContext,
        FavoriteDatabase::class.java,
        "openspot.db",
    ).build()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    val repository: PlaceRepository = DefaultPlaceRepository(client, database.favoriteDao())
    val locationProvider = LocationProvider(context.applicationContext)
}
