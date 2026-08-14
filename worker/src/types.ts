export const categories = ["free_wifi", "bicycle_parking", "motorcycle_parking", "cafe_open_now"] as const;
export type PlaceCategory = (typeof categories)[number];

export interface Place {
  id: string;
  source: "OpenStreetMap";
  category: PlaceCategory;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  address: string | null;
  openingHours: string | null;
  fee: string | null;
  access: string | null;
  capacity: number | null;
  sourceUrl: string;
  updatedAt: string | null;
}

export interface Env {
  CACHE: KVNamespace;
  OVERPASS_URL?: string;
  NOMINATIM_URL?: string;
  USER_AGENT?: string;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  timestamp?: string;
}
