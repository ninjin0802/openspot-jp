# Architecture

The Android client owns presentation, foreground location access, favorites, and external-navigation intents. It calls a versioned Worker API and never contacts Overpass or Nominatim directly.

The Worker validates and normalizes requests, queries upstream data providers, applies strict category rules, computes distances, and returns source attribution. KV caches successful results and provides a bounded stale fallback during upstream outages.

The public API consists of `GET /api/v1/places`, `GET /api/v1/geocode`, and `GET /api/v1/health`.
