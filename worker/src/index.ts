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
  const current = hour * 60 + minute;
  return value.split(";").some((rawRule) => {
    const match = rawRule.trim().match(/^(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return false;
    const [, fromDay, toDay, sh, sm, eh, em] = match;
    if (fromDay) {
      const currentDay = DAY_NAMES.indexOf(weekday);
      const startDay = DAY_NAMES.indexOf(fromDay);
      const endDay = DAY_NAMES.indexOf(toDay ?? fromDay);
      const dayMatches = startDay <= endDay ? currentDay >= startDay && currentDay <= endDay : currentDay >= startDay || currentDay <= endDay;
      if (!dayMatches) return false;
    }
    const start = Number(sh) * 60 + Number(sm);
    const end = Number(eh) * 60 + Number(em);
    return end > start ? current >= start && current < end : current >= start || current < end;
  });
}

export function buildOverpassQuery(params: SearchParams): string {
  const around = `(around:${params.radiusMeters},${params.latitude},${params.longitude})`;
  const selectors: string[] = [];
  if (params.categories.has("free_wifi")) selectors.push(`nwr${around}["internet_access"="wlan"]["internet_access:fee"="no"];`);
  if (params.categories.has("bicycle_parking")) selectors.push(`nwr${around}["amenity"="bicycle_parking"];`);
  if (params.categories.has("motorcycle_parking")) selectors.push(`nwr${around}["amenity"="motorcycle_parking"];`);
  if (params.categories.has("cafe_open_now")) selectors.push(`nwr${around}["amenity"="cafe"]["opening_hours"];`);
  return `[out:json][timeout:20];(${selectors.join("")});out center tags;`;
}

function categoryFor(tags: Record<string, string>, requested: Set<PlaceCategory>, now: Date): PlaceCategory | null {
  if (requested.has("free_wifi") && tags.internet_access === "wlan" && tags["internet_access:fee"] === "no") return "free_wifi";
  if (requested.has("bicycle_parking") && tags.amenity === "bicycle_parking") return "bicycle_parking";
  if (requested.has("motorcycle_parking") && tags.amenity === "motorcycle_parking") return "motorcycle_parking";
  if (requested.has("cafe_open_now") && tags.amenity === "cafe" && tags.opening_hours && openingHoursIsOpenNow(tags.opening_hours, now)) return "cafe_open_now";
  return null;
}

export function parseOverpassElements(elements: OverpassElement[], params: SearchParams, now = new Date()): Place[] {
  const seen = new Set<string>();
  return elements.flatMap((element): Place[] => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const category = categoryFor(tags, params.categories, now);
    if (latitude === undefined || longitude === undefined || !category) return [];
    const distanceMeters = haversineMeters(params.latitude, params.longitude, latitude, longitude);
    const id = `osm:${element.type}/${element.id}`;
    if (distanceMeters > params.radiusMeters || seen.has(id)) return [];
    seen.add(id);
    const address = [tags["addr:province"], tags["addr:city"], tags["addr:suburb"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join("");
    return [{
      id, source: "OpenStreetMap", category, name: tags.name ?? tags.operator ?? categoryLabel(category), latitude, longitude,
      distanceMeters: Math.round(distanceMeters), address: address || null, openingHours: tags.opening_hours ?? null,
      fee: tags.fee ?? tags["internet_access:fee"] ?? null, access: tags.access ?? null,
      capacity: tags.capacity && /^\d+$/.test(tags.capacity) ? Number(tags.capacity) : null,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, updatedAt: element.timestamp ?? null,
    }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function categoryLabel(category: PlaceCategory): string {
  return ({ free_wifi: "無料Wi-Fi", bicycle_parking: "自転車駐輪場", motorcycle_parking: "バイク駐輪場", cafe_open_now: "営業中カフェ" })[category];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function places(requestUrl: URL, env: Env): Promise<Response> {
  const params = parseSearchParams(requestUrl);
  const cacheKey = `places:${params.latitude.toFixed(3)}:${params.longitude.toFixed(3)}:${params.radiusMeters}:${[...params.categories].sort().join(",")}`;
  const cached = await env.CACHE.get(cacheKey, "json") as { storedAt: number; data: Place[] } | null;
  const age = cached ? Date.now() - cached.storedAt : Infinity;
  if (cached && age <= 6 * 60 * 60 * 1000) return json({ data: cached.data, meta: meta("hit") });
  try {
    const upstream = await fetch(env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": env.USER_AGENT ?? "OpenSpot-JP/0.1" },
      body: new URLSearchParams({ data: buildOverpassQuery(params) }),
    });
    if (!upstream.ok) throw new Error(`Overpass ${upstream.status}`);
    const payload = await upstream.json() as { elements?: OverpassElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("Malformed Overpass response");
    const data = parseOverpassElements(payload.elements, params);
    await env.CACHE.put(cacheKey, JSON.stringify({ storedAt: Date.now(), data }), { expirationTtl: 86_400 });
    return json({ data, meta: meta("miss") });
  } catch (error) {
    if (cached && age <= 24 * 60 * 60 * 1000) return json({ data: cached.data, meta: meta("stale") });
    throw error;
  }
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
