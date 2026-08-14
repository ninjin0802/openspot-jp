package io.github.ninjin0802.openspotjp.data

import io.github.ninjin0802.openspotjp.BuildConfig
import io.github.ninjin0802.openspotjp.data.local.FavoriteDao
import io.github.ninjin0802.openspotjp.data.local.FavoriteEntity
import io.github.ninjin0802.openspotjp.data.model.ApiMeta
import io.github.ninjin0802.openspotjp.data.model.GeocodeResult
import io.github.ninjin0802.openspotjp.data.model.Place
import io.github.ninjin0802.openspotjp.data.model.PlaceCategory
import io.github.ninjin0802.openspotjp.data.model.PlacesResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException

interface PlaceRepository {
    suspend fun searchPlaces(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int,
        categories: Set<PlaceCategory>,
    ): Result<PlacesResponse>

    suspend fun geocode(query: String): Result<List<GeocodeResult>>
    fun observeFavorites(): Flow<List<Place>>
    suspend fun toggleFavorite(place: Place): Boolean
    suspend fun isFavorite(id: String): Boolean
}

class DefaultPlaceRepository(
    private val client: OkHttpClient,
    private val favoriteDao: FavoriteDao,
) : PlaceRepository {
    override suspend fun searchPlaces(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int,
        categories: Set<PlaceCategory>,
    ): Result<PlacesResponse> = runCatching {
        require(latitude in -90.0..90.0 && longitude in -180.0..180.0)
        require(radiusMeters in 100..5_000)
        require(categories.isNotEmpty())
        val url = BuildConfig.API_BASE_URL.toHttpUrl().newBuilder()
            .addPathSegments("api/v1/places")
            .addQueryParameter("lat", latitude.toString())
            .addQueryParameter("lng", longitude.toString())
            .addQueryParameter("radiusMeters", radiusMeters.toString())
            .addQueryParameter("categories", categories.joinToString(",") { it.apiValue })
            .build()
        parsePlaces(execute(url.toString()))
    }

    override suspend fun geocode(query: String): Result<List<GeocodeResult>> = runCatching {
        require(query.trim().length in 2..80)
        val url = BuildConfig.API_BASE_URL.toHttpUrl().newBuilder()
            .addPathSegments("api/v1/geocode")
            .addQueryParameter("q", query.trim())
            .addQueryParameter("limit", "5")
            .build()
        val root = JSONObject(execute(url.toString()))
        val rows = root.getJSONArray("data")
        List(rows.length()) { index ->
            rows.getJSONObject(index).let {
                GeocodeResult(it.getString("name"), it.getDouble("latitude"), it.getDouble("longitude"))
            }
        }
    }

    override fun observeFavorites(): Flow<List<Place>> = favoriteDao.observeAll().map { rows -> rows.map(FavoriteEntity::toPlace) }

    override suspend fun toggleFavorite(place: Place): Boolean = withContext(Dispatchers.IO) {
        if (favoriteDao.findById(place.id) == null) {
            favoriteDao.upsert(place.toEntity())
            true
        } else {
            favoriteDao.deleteById(place.id)
            false
        }
    }

    override suspend fun isFavorite(id: String): Boolean = withContext(Dispatchers.IO) { favoriteDao.findById(id) != null }

    private suspend fun execute(url: String): String = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(url).header("Accept", "application/json").build()).execute().use { response ->
            if (!response.isSuccessful) throw IOException("API request failed (${response.code})")
            response.body.string()
        }
    }

    private fun parsePlaces(body: String): PlacesResponse {
        val root = JSONObject(body)
        val data = root.getJSONArray("data")
        val places = List(data.length()) { index ->
            val row = data.getJSONObject(index)
            Place(
                id = row.getString("id"),
                source = row.getString("source"),
                category = PlaceCategory.entries.first { it.apiValue == row.getString("category") },
                name = row.getString("name"),
                latitude = row.getDouble("latitude"),
                longitude = row.getDouble("longitude"),
                address = row.optStringOrNull("address"),
                distanceMeters = row.optDoubleOrNull("distanceMeters"),
                openingHours = row.optStringOrNull("openingHours"),
                fee = row.optStringOrNull("fee"),
                access = row.optStringOrNull("access"),
                capacity = row.optIntOrNull("capacity"),
                sourceUrl = row.optStringOrNull("sourceUrl"),
                updatedAt = row.optStringOrNull("updatedAt"),
            )
        }
        val meta = root.getJSONObject("meta")
        val attributions = meta.getJSONArray("attributions")
        return PlacesResponse(
            data = places,
            meta = ApiMeta(
                generatedAt = meta.getString("generatedAt"),
                cacheStatus = meta.getString("cacheStatus"),
                attributions = List(attributions.length()) { attributions.getString(it) },
            ),
        )
    }
}

private fun JSONObject.optStringOrNull(key: String): String? = if (isNull(key)) null else optString(key).takeIf(String::isNotBlank)
private fun JSONObject.optDoubleOrNull(key: String): Double? = if (isNull(key) || !has(key)) null else getDouble(key)
private fun JSONObject.optIntOrNull(key: String): Int? = if (isNull(key) || !has(key)) null else getInt(key)

private fun Place.toEntity() = FavoriteEntity(id, source, category.apiValue, name, latitude, longitude, address, openingHours, fee, access, capacity, sourceUrl, updatedAt)
private fun FavoriteEntity.toPlace() = Place(id, source, PlaceCategory.entries.first { it.apiValue == category }, name, latitude, longitude, address, null, openingHours, fee, access, capacity, sourceUrl, updatedAt)
