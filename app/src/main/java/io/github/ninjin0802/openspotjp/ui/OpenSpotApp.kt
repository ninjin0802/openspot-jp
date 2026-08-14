package io.github.ninjin0802.openspotjp.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.ninjin0802.openspotjp.data.AppContainer
import io.github.ninjin0802.openspotjp.data.model.Place
import io.github.ninjin0802.openspotjp.data.model.PlaceCategory
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.annotations.IconFactory
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.annotations.MarkerOptions

private const val MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenSpotApp(container: AppContainer) {
    val vm: OpenSpotViewModel = viewModel(factory = OpenSpotViewModel.Factory(container))
    val state by vm.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var favoritesOnly by remember { mutableStateOf(false) }
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants.values.any { it }) vm.locateAndSearch()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("OpenSpot JP") },
                actions = {
                    TextButton(onClick = { favoritesOnly = !favoritesOnly }) {
                        Text(if (favoritesOnly) "周辺" else "お気に入り")
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = state.query,
                    onValueChange = vm::updateQuery,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("地名・住所") },
                )
                Button(onClick = vm::submitGeocode, modifier = Modifier.padding(start = 8.dp)) { Text("検索") }
            }

            if (!favoritesOnly) {
                ChipRows(state, vm)
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        locationPermission.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
                    }) { Text("現在地") }
                    Button(onClick = vm::searchCurrentArea) { Text("このエリアを検索") }
                }
                MapPanel(state.center, state.userLocation, state.places, vm::selectPlace)
            }

            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 12.dp)) }
            Text(
                if (favoritesOnly) "お気に入り ${state.favorites.size}件" else "検索結果 ${state.places.size}件${state.cacheStatus?.let { " / $it" } ?: ""}",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            )
            PlaceList(
                places = if (favoritesOnly) state.favorites else state.places,
                favoriteIds = state.favorites.mapTo(hashSetOf()) { it.id },
                onFavorite = vm::toggleFavorite,
                onNavigate = { place ->
                    val label = Uri.encode(place.name)
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${place.latitude},${place.longitude}($label)")))
                },
            )
        }
    }
}

@Composable
private fun ChipRows(state: OpenSpotUiState, vm: OpenSpotViewModel) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PlaceCategory.entries.forEach { category ->
            FilterChip(selected = category in state.selectedCategories, onClick = { vm.toggleCategory(category) }, label = { Text(category.label) })
        }
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(500, 1_000, 2_000, 5_000).forEach { radius ->
            FilterChip(selected = radius == state.radiusMeters, onClick = { vm.setRadius(radius) }, label = { Text(if (radius < 1_000) "${radius}m" else "${radius / 1_000}km") })
        }
    }
}

@Composable
private fun MapPanel(center: MapCenter, userLocation: MapCenter?, places: List<Place>, onSelect: (Place) -> Unit) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember { MapView(context) }
    var map by remember { mutableStateOf<MapLibreMap?>(null) }

    DisposableEffect(lifecycle, mapView) {
        mapView.onCreate(null)
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                Lifecycle.Event.ON_DESTROY -> mapView.onDestroy()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        mapView.getMapAsync { ready -> ready.setStyle(MAP_STYLE_URL) { map = ready } }
        onDispose { lifecycle.removeObserver(observer); mapView.onDestroy() }
    }

    LaunchedEffect(map, center, userLocation, places) {
        map?.let { ready ->
            ready.clear()
            places.forEach { place ->
                ready.addMarker(MarkerOptions().position(LatLng(place.latitude, place.longitude)).title(place.name).snippet(place.category.label))
            }
            userLocation?.let { location ->
                val icon = IconFactory.getInstance(context).fromBitmap(createUserLocationBitmap(context))
                ready.addMarker(MarkerOptions().position(LatLng(location.latitude, location.longitude)).icon(icon))
            }
            ready.setOnMarkerClickListener { marker ->
                places.firstOrNull { it.name == marker.title }?.let(onSelect)
                false
            }
            ready.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(center.latitude, center.longitude), 14.0))
        }
    }
    Box(Modifier.fillMaxWidth().height(320.dp).padding(vertical = 6.dp)) { AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize()) }
}

private fun createUserLocationBitmap(context: Context): Bitmap {
    val density = context.resources.displayMetrics.density
    val size = (40 * density).toInt()
    val center = size / 2f
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.argb(55, 26, 115, 232)
    canvas.drawCircle(center, center, 18 * density, paint)
    paint.color = Color.WHITE
    canvas.drawCircle(center, center, 10 * density, paint)
    paint.color = Color.rgb(26, 115, 232)
    canvas.drawCircle(center, center, 7 * density, paint)
    return bitmap
}

@Composable
private fun PlaceList(
    places: List<Place>,
    favoriteIds: Set<String>,
    onFavorite: (Place) -> Unit,
    onNavigate: (Place) -> Unit,
) {
    LazyColumn(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items(places, key = { it.id }) { place ->
            Card(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(place.name, style = MaterialTheme.typography.titleMedium)
                    Text("${place.category.label}${place.distanceMeters?.let { " / ${it.toInt()}m" } ?: ""}")
                    place.address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { onFavorite(place) }) { Text(if (place.id in favoriteIds) "★ 保存済み" else "☆ 保存") }
                        TextButton(onClick = { onNavigate(place) }) { Text("経路") }
                    }
                }
            }
        }
    }
}
