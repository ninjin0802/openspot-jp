package io.github.ninjin0802.openspotjp.data.model

enum class PlaceCategory(val apiValue: String, val label: String) {
    FREE_WIFI("free_wifi", "無料Wi-Fi"),
    BICYCLE_PARKING("bicycle_parking", "自転車駐輪場"),
    MOTORCYCLE_PARKING("motorcycle_parking", "バイク駐輪場"),
    CAFE_OPEN_NOW("cafe_open_now", "カフェ"),
}

data class Place(
    val id: String,
    val source: String,
    val category: PlaceCategory,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val address: String? = null,
    val distanceMeters: Double? = null,
    val openingHours: String? = null,
    val fee: String? = null,
    val access: String? = null,
    val capacity: Int? = null,
    val sourceUrl: String? = null,
    val updatedAt: String? = null,
)

data class ApiMeta(
    val generatedAt: String,
    val cacheStatus: String,
    val attributions: List<String>,
)

data class PlacesResponse(val data: List<Place>, val meta: ApiMeta)
data class GeocodeResult(val name: String, val latitude: Double, val longitude: Double)
