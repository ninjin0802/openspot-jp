# OpenSpot JP

OpenSpot JPは、日本全国の無料確認済みWi-Fi、自転車駐輪場、オートバイ駐輪場、現在営業中のカフェを現在地や地名から探すAndroidアプリです。

## 構成

- Android: Kotlin、Jetpack Compose、MapLibre Native、Room
- API: Cloudflare Workers、KV、OpenStreetMap Overpass、Nominatim
- 地図: OpenFreeMapのベクタータイルとPositronスタイル

## 開発

```powershell
./gradlew.bat testDebugUnitTest lintDebug assembleDebug
npm --prefix worker install
npm --prefix worker test
npm --prefix worker run typecheck
```

Androidから利用するAPIはGradleプロパティで指定します。

```powershell
./gradlew.bat assembleDebug -POPENSPOT_API_BASE_URL=https://your-worker.example/
```

## データに関する注意

施設情報はオープンデータに依存するため、完全性・最新性を保証しません。利用前に現地表示や施設公式情報も確認してください。

## License

Source code is licensed under Apache License 2.0. OpenStreetMap data and GSI tiles remain subject to their respective terms.
