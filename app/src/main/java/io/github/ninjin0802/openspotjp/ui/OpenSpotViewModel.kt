package io.github.ninjin0802.openspotjp.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.ninjin0802.openspotjp.data.AppContainer
import io.github.ninjin0802.openspotjp.data.model.Place
import io.github.ninjin0802.openspotjp.data.model.PlaceCategory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MapCenter(val latitude: Double, val longitude: Double)

data class OpenSpotUiState(
    val center: MapCenter = MapCenter(35.681236, 139.767125),
    val userLocation: MapCenter? = null,
    val radiusMeters: Int = 2_000,
    val selectedCategories: Set<PlaceCategory> = PlaceCategory.entries.toSet(),
    val places: List<Place> = emptyList(),
    val favorites: List<Place> = emptyList(),
    val selectedPlace: Place? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val query: String = "",
    val cacheStatus: String? = null,
)

class OpenSpotViewModel(private val container: AppContainer) : ViewModel() {
    private val _uiState = MutableStateFlow(OpenSpotUiState())
    val uiState: StateFlow<OpenSpotUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            container.repository.observeFavorites().collect { favorites ->
                _uiState.update { it.copy(favorites = favorites) }
            }
        }
    }

    fun updateQuery(query: String) = _uiState.update { it.copy(query = query) }

    fun locateAndSearch() = viewModelScope.launch {
        _uiState.update { it.copy(loading = true, error = null) }
        val location = container.locationProvider.currentLocation()
        if (location == null) {
            _uiState.update { it.copy(loading = false, error = "現在地を取得できませんでした") }
            return@launch
        }
        val current = MapCenter(location.latitude, location.longitude)
        _uiState.update { it.copy(center = current, userLocation = current) }
        searchAtCurrentCenter()
    }

    fun searchCurrentArea() = viewModelScope.launch { searchAtCurrentCenter() }

    fun submitGeocode() = viewModelScope.launch {
        val query = _uiState.value.query.trim()
        if (query.length !in 2..80) {
            _uiState.update { it.copy(error = "地名を2〜80文字で入力してください") }
            return@launch
        }
        _uiState.update { it.copy(loading = true, error = null) }
        container.repository.geocode(query).fold(
            onSuccess = { results ->
                val first = results.firstOrNull()
                if (first == null) {
                    _uiState.update { it.copy(loading = false, error = "該当する場所が見つかりません") }
                } else {
                    _uiState.update { it.copy(center = MapCenter(first.latitude, first.longitude)) }
                    searchAtCurrentCenter()
                }
            },
            onFailure = { error -> _uiState.update { it.copy(loading = false, error = error.message ?: "地名検索に失敗しました") } },
        )
    }

    fun toggleCategory(category: PlaceCategory) {
        _uiState.update { state ->
            val next = state.selectedCategories.toMutableSet()
            if (category in next) {
                if (next.size > 1) next.remove(category)
            } else {
                next.add(category)
            }
            state.copy(selectedCategories = next)
        }
    }

    fun setRadius(radiusMeters: Int) {
        if (radiusMeters in setOf(500, 1_000, 2_000, 5_000)) _uiState.update { it.copy(radiusMeters = radiusMeters) }
    }

    fun selectPlace(place: Place?) = _uiState.update { it.copy(selectedPlace = place) }

    fun toggleFavorite(place: Place) = viewModelScope.launch { container.repository.toggleFavorite(place) }

    private suspend fun searchAtCurrentCenter() {
        val state = _uiState.value
        _uiState.update { it.copy(loading = true, error = null) }
        container.repository.searchPlaces(
            state.center.latitude,
            state.center.longitude,
            state.radiusMeters,
            state.selectedCategories,
        ).fold(
            onSuccess = { response -> _uiState.update { it.copy(places = response.data, cacheStatus = response.meta.cacheStatus, loading = false) } },
            onFailure = { error -> _uiState.update { it.copy(loading = false, error = error.message ?: "周辺検索に失敗しました") } },
        )
    }

    class Factory(private val container: AppContainer) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(OpenSpotViewModel::class.java))
            @Suppress("UNCHECKED_CAST")
            return OpenSpotViewModel(container) as T
        }
    }
}
