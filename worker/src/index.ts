import { categories, type Env, type OverpassElement, type Place, type PlaceCategory } from "./types";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };
const ATTRIBUTIONS = ["© OpenStreetMap contributors (ODbL)"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface SearchParams {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  categories: Set<PlaceCategory>;
}

export function parseSearchParams(url: URL): SearchParams {
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  const radiusMeters = Number(url.searchParams.get("radiusMeters"));
  const requested = (url.searchParams.get("categories") ?? "").split(",").filter(Boolean);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("lat must be between -90 and 90");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("lng must be between -180 and 180");
  if (!Number.isInteger(radiusMeters) || radiusMeters < 100 || radiusMeters > 5_000) throw new Error("radiusMeters must be 100..5000");
  if (requested.length === 0 || requested.some((value) => !categories.includes(value as PlaceCategory))) throw new Error("categories contains an unsupported value");
  return { latitude, longitude, radiusMeters, categories: new Set(requested as PlaceCategory[]) };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function openingHoursIsOpenNow(value: string, now = new Date()): boolean {
  const japanParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const weekday = japanParts.find((part) => part.type === "weekday")?.value.slice(0, 2);
  const hour = Number(japanParts.find((part) => part.type === "hour")?.value);
  const minute = Number(japanParts.find((part) => part.type === "minute")?.value);
  if (!weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  if (value.trim() === "24/7") return true;
  const currentDay = DAY_NAMES.indexOf(weekday);
  const current = hour * 60 + minute;
  return value.split(";").some((rawRule) => {
    const rule = rawRule.trim();
    if (!rule || /\boff\b/i.test(rule)) return false;
    const ranges = [...rule.matchAll(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g)];
    if (ranges.length === 0) return false;
    const dayExpression = rule.slice(0, ranges[0]?.index ?? 0);
    const selectedDays = new Set<number>();
    for (const match of dayExpression.matchAll(/(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?/g)) {
      const fromDay = match[1];
      if (!fromDay) continue;
      const startDay = DAY_NAMES.indexOf(fromDay);
      const endDay = DAY_NAMES.indexOf(match[2] ?? fromDay);
      for (let day = startDay; ; day = (day + 1) % 7) {
        selectedDays.add(day);
        if (day === endDay) break;
      }
    }
    const dayMatches = (day: number) => selectedDays.size === 0 || selectedDays.has(day);
    return ranges.some(([, sh, sm, eh, em]) => {
      const start = Number(sh) * 60 + Number(sm);
      const end = Number(eh) * 60 + Number(em);
      if (start === end) return dayMatches(currentDay);
      if (end > start) return dayMatches(currentDay) && current >= start && current < end;
      return (dayMatches(currentDay) && current >= start) || (dayMatches((currentDay + 6) % 7) && current < end);
    });
  });
}

export function buildOverpassQuery(params: SearchParams): string {
  const around = `(around:${params.radiusMeters},${params.latitude},${params.longitude})`;
  const selectors: string[] = [];
  if (params.categories.has("free_wifi")) {
    selectors.push(`nwr${around}["internet_access"="wlan"]["internet_access:fee"!="yes"]["fee"!="yes"];`);
    selectors.push(`nwr${around}["wifi"="yes"]["internet_access:fee"!="yes"]["fee"!="yes"];`);
  }
  if (params.categories.has("bicycle_parking")) selectors.push(`nwr${around}["amenity"="bicycle_parking"];`);
  if (params.categories.has("motorcycle_parking")) selectors.push(`nwr${around}["amenity"="motorcycle_parking"];`);
  if (params.categories.has("cafe_open_now")) selectors.push(`nwr${around}["amenity"="cafe"];`);
  return `[out:json][timeout:20];(${selectors.join("")});out center tags;`;
}

function categoriesFor(tags: Record<string, string>, requested: Set<PlaceCategory>, now: Date): PlaceCategory[] {
  const matched: PlaceCategory[] = [];
  const hasWifi = tags.internet_access === "wlan" || tags.wifi === "yes";
  const explicitlyPaid = tags["internet_access:fee"] === "yes" || tags.fee === "yes";
  if (requested.has("free_wifi") && hasWifi && !explicitlyPaid) matched.push("free_wifi");
  if (requested.has("bicycle_parking") && tags.amenity === "bicycle_parking") matched.push("bicycle_parking");
  if (requested.has("motorcycle_parking") && tags.amenity === "motorcycle_parking") matched.push("motorcycle_parking");
  if (requested.has("cafe_open_now") && tags.amenity === "cafe") matched.push("cafe_open_now");
  return matched;
}

export function parseOverpassElements(elements: OverpassElement[], params: SearchParams, now = new Date()): Place[] {
  const seen = new Set<string>();
  return elements.flatMap((element): Place[] => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const matchedCategories = categoriesFor(tags, params.categories, now);
    if (latitude === undefined || longitude === undefined || matchedCategories.length === 0) return [];
    const distanceMeters = haversineMeters(params.latitude, params.longitude, latitude, longitude);
    if (distanceMeters > params.radiusMeters) return [];
    const address = [tags["addr:province"], tags["addr:city"], tags["addr:suburb"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join("");
    return matchedCategories.flatMap((category): Place[] => {
      const id = `osm:${element.type}/${element.id}:${category}`;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{
      id, source: "OpenStreetMap", category, name: tags.name ?? tags.operator ?? categoryLabel(category), latitude, longitude,
      distanceMeters: Math.round(distanceMeters), address: address || null, openingHours: tags.opening_hours ?? null,
      fee: tags.fee ?? tags["internet_access:fee"] ?? null, access: tags.access ?? null,
      capacity: tags.capacity && /^\d+$/.test(tags.capacity) ? Number(tags.capacity) : null,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, updatedAt: element.timestamp ?? null,
      }];
    });
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function categoryLabel(category: PlaceCategory): string {
  return ({ free_wifi: "無料Wi-Fi", bicycle_parking: "自転車駐輪場", motorcycle_parking: "バイク駐輪場", cafe_open_now: "カフェ" })[category];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function placesForCategory(params: SearchParams, category: PlaceCategory, env: Env): Promise<{ data: Place[]; cacheStatus: string }> {
  const categoryParams = { ...params, categories: new Set([category]) };
  const cacheKey = `places:v4:${params.latitude.toFixed(3)}:${params.longitude.toFixed(3)}:${params.radiusMeters}:${category}`;
  const cached = await env.CACHE.get(cacheKey, "json") as { storedAt: number; data: Place[] } | null;
  const age = cached ? Date.now() - cached.storedAt : Infinity;
  if (cached && age <= 6 * 60 * 60 * 1000) return { data: cached.data, cacheStatus: "hit" };
  try {
    const upstream = await fetch(env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": env.USER_AGENT ?? "OpenSpot-JP/0.1" },
      body: new URLSearchParams({ data: buildOverpassQuery(categoryParams) }),
    });
    if (!upstream.ok) throw new Error(`Overpass ${upstream.status}`);
    const payload = await upstream.json() as { elements?: OverpassElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("Malformed Overpass response");
    const data = parseOverpassElements(payload.elements, categoryParams);
    await env.CACHE.put(cacheKey, JSON.stringify({ storedAt: Date.now(), data }), { expirationTtl: 86_400 });
    return { data, cacheStatus: "miss" };
  } catch (error) {
    if (cached && age <= 24 * 60 * 60 * 1000) return { data: cached.data, cacheStatus: "stale" };
    throw error;
  }
}

async function places(requestUrl: URL, env: Env): Promise<Response> {
  const params = parseSearchParams(requestUrl);
  const requested = [...params.categories];
  const results = await Promise.allSettled(requested.map((category) => placesForCategory(params, category, env)));
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (fulfilled.length === 0) {
    const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    throw failure?.reason ?? new Error("All Overpass requests failed");
  }
  const data = fulfilled.flatMap((result) => result.data).sort((a, b) => a.distanceMeters - b.distanceMeters);
  const cacheStatus = fulfilled.length < requested.length ? "partial"
    : fulfilled.some((result) => result.cacheStatus === "miss") ? "miss"
      : fulfilled.some((result) => result.cacheStatus === "stale") ? "stale" : "hit";
  return json({ data, meta: meta(cacheStatus) });
}

async function geocode(requestUrl: URL, env: Env): Promise<Response> {
  const query = (requestUrl.searchParams.get("q") ?? "").trim();
  const limit = Number(requestUrl.searchParams.get("limit") ?? "5");
  if (query.length < 2 || query.length > 80 || !Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error("invalid geocode query");
  const cacheKey = `geocode:${query.toLocaleLowerCase("ja-JP")}:${limit}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) return json({ data: cached, meta: meta("hit") });
  const url = new URL(env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", countrycodes: "jp", limit: String(limit) }).toString();
  const response = await fetch(url, { headers: { "user-agent": env.USER_AGENT ?? "OpenSpot-JP/0.1", accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const raw = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string }>;
  const data = raw.flatMap((row) => row.display_name && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon))
    ? [{ name: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon) }] : []);
  await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 30 * 86_400 });
  return json({ data, meta: meta("miss") });
}

function meta(cacheStatus: string) {
  return { generatedAt: new Date().toISOString(), cacheStatus, attributions: ATTRIBUTIONS };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (request.method !== "GET") return json({ error: { code: "method_not_allowed", message: "GET only" } }, 405);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/v1/health") return json({ data: { status: "ok", version: "0.1.0" } });
      if (url.pathname === "/api/v1/places") return await places(url, env);
      if (url.pathname === "/api/v1/geocode") return await geocode(url, env);
      return json({ error: { code: "not_found", message: "Not found" } }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const validation = message.startsWith("lat ") || message.startsWith("lng ") || message.startsWith("radius") || message.startsWith("categories") || message.startsWith("invalid geocode");
      return json({ error: { code: validation ? "invalid_request" : "upstream_unavailable", message } }, validation ? 400 : 503);
    }
  },
};
