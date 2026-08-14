# Data sources

- Map background: Geospatial Information Authority of Japan standard tiles. Follow the GSI content terms and preserve attribution.
- Points of interest: OpenStreetMap through Overpass API, licensed under ODbL. Display `© OpenStreetMap contributors`.
- Place-name search: the public Nominatim service through the Worker proxy. Requests are user-submitted, cached, identifiable, Japan-filtered, and must remain below the service policy limit. Autocomplete is not implemented.

Free Wi-Fi requires both `internet_access=wlan` and `internet_access:fee=no`. Cafes with missing or unsupported `opening_hours` are excluded from the open-now category.
