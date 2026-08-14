# Changelog

All notable changes follow Semantic Versioning.

## [0.1.0] - 2026-08-14

### Added

- Initial Android map, nearby search, category filters, local favorites, and external navigation.
- Cloudflare Worker integration for Overpass and Nominatim with caching and attribution.
- Role-based Codex subagent engineering loop and continuous integration.
- OpenSpot JP map-pin application icon and Android launcher density assets.
- Production Cloudflare Worker deployment with a KV-backed response cache.

### Fixed

- Initialize MapLibre before creating the map view, preventing an immediate startup crash.
- Replace the dense raster basemap with a crisp, low-noise OpenFreeMap vector style.
- Point Android builds at the deployed OpenSpot JP API by default.
- Handle unavailable current-location callbacks without crashing.
- Broaden free Wi-Fi discovery, support common OSM opening-hours syntax, and retain both categories for Wi-Fi cafés.
- Split multi-category Overpass searches into independently cached requests so one slow category cannot discard all results.
- Return cafés without requiring opening-hours data; show hours when OpenStreetMap provides them.
- Show the user's actual location as a Google Maps-style blue dot with a translucent accuracy halo.
