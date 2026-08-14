# Changelog

All notable changes follow Semantic Versioning.

## [0.1.0] - 2026-08-14

### Added

- Initial Android map, nearby search, category filters, local favorites, and external navigation.
- Cloudflare Worker integration for Overpass and Nominatim with caching and attribution.
- Qwen implementation-worker engineering loop and continuous integration.
- OpenSpot JP map-pin application icon and Android launcher density assets.

### Fixed

- Initialize MapLibre before creating the map view, preventing an immediate startup crash.
