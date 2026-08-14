import { describe, expect, it } from "vitest";
import { haversineMeters, openingHoursIsOpenNow, parseOverpassElements, parseSearchParams } from "../src/index";

const params = {
  latitude: 35.681236,
  longitude: 139.767125,
  radiusMeters: 2_000,
  categories: new Set(["free_wifi", "bicycle_parking", "motorcycle_parking", "cafe_open_now"] as const),
};

describe("request validation", () => {
  it("accepts a valid search", () => {
    const parsed = parseSearchParams(new URL("https://x/api/v1/places?lat=35.68&lng=139.76&radiusMeters=2000&categories=free_wifi,bicycle_parking"));
    expect(parsed.radiusMeters).toBe(2000);
  });

  it("rejects invalid radius and categories", () => {
    expect(() => parseSearchParams(new URL("https://x/api/v1/places?lat=35&lng=139&radiusMeters=9999&categories=nope"))).toThrow();
  });
});

describe("geospatial helpers", () => {
  it("calculates distance", () => {
    expect(haversineMeters(35.681236, 139.767125, 35.681236, 139.767125)).toBe(0);
    expect(haversineMeters(35.681236, 139.767125, 35.69, 139.77)).toBeGreaterThan(900);
  });

  it("handles common opening hours in Japan", () => {
    const mondayNoonJst = new Date("2026-08-17T03:00:00Z");
    expect(openingHoursIsOpenNow("Mo-Fr 09:00-22:00", mondayNoonJst)).toBe(true);
    expect(openingHoursIsOpenNow("Mo-Fr 18:00-22:00", mondayNoonJst)).toBe(false);
    expect(openingHoursIsOpenNow("24/7", mondayNoonJst)).toBe(true);
    expect(openingHoursIsOpenNow("Sa,Su,PH 09:00-18:00; Mo-Fr 08:00-13:00,14:00-22:00", mondayNoonJst)).toBe(true);
    expect(openingHoursIsOpenNow("Sa,Su,PH 09:00-18:00", mondayNoonJst)).toBe(false);
    expect(openingHoursIsOpenNow("unsupported", mondayNoonJst)).toBe(false);
  });
});

describe("Overpass parsing", () => {
  it("finds non-paid wifi tags and separates parking", () => {
    const data = parseOverpassElements([
      { type: "node", id: 1, lat: 35.6813, lon: 139.7672, tags: { internet_access: "wlan", "internet_access:fee": "no", name: "Wi-Fi" } },
      { type: "node", id: 2, lat: 35.6814, lon: 139.7672, tags: { internet_access: "wlan", name: "Unknown fee" } },
      { type: "node", id: 3, lat: 35.6815, lon: 139.7672, tags: { amenity: "bicycle_parking" } },
      { type: "node", id: 4, lat: 35.6816, lon: 139.7672, tags: { amenity: "motorcycle_parking" } },
      { type: "node", id: 8, lat: 35.6817, lon: 139.7672, tags: { wifi: "yes", fee: "yes", name: "Paid" } },
    ], params, new Date("2026-08-17T03:00:00Z"));
    expect(data.map((place) => place.category)).toEqual(["free_wifi", "free_wifi", "bicycle_parking", "motorcycle_parking"]);
  });

  it("returns a wifi cafe in both requested categories", () => {
    const data = parseOverpassElements([
      { type: "node", id: 9, lat: 35.6813, lon: 139.7672, tags: { amenity: "cafe", internet_access: "wlan", opening_hours: "24/7", name: "Both" } },
    ], params, new Date("2026-08-17T03:00:00Z"));
    expect(data.map((place) => place.category)).toEqual(["free_wifi", "cafe_open_now"]);
    expect(new Set(data.map((place) => place.id)).size).toBe(2);
  });

  it("keeps cafes even when opening hours are closed or unavailable", () => {
    const data = parseOverpassElements([
      { type: "node", id: 5, lat: 35.6813, lon: 139.7672, tags: { amenity: "cafe", opening_hours: "Mo-Fr 09:00-22:00", name: "Open" } },
      { type: "node", id: 6, lat: 35.6814, lon: 139.7672, tags: { amenity: "cafe", opening_hours: "Mo-Fr 18:00-22:00", name: "Closed" } },
      { type: "node", id: 10, lat: 35.6815, lon: 139.7672, tags: { amenity: "cafe", name: "Hours unknown" } },
      { type: "way", id: 7, tags: { amenity: "cafe", opening_hours: "24/7" } },
    ], params, new Date("2026-08-17T03:00:00Z"));
    expect(data.map((place) => place.name)).toEqual(["Open", "Closed", "Hours unknown"]);
  });
});
