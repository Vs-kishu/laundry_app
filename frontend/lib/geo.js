const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Road geometry from the public OSRM demo server. It has no SLA, so callers must handle null
// (we then draw a straight line). For production point this at your own OSRM/Valhalla/Mapbox.
export async function fetchRoute(from, to, signal) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: route.distance / 1000,
    };
  } catch {
    return null;
  }
}

// Address search / reverse geocoding via OpenStreetMap Nominatim (usage policy: max ~1 req/s,
// so callers debounce). Swap for Google Places / Mapbox in production.
export async function searchPlaces(query, near, signal) {
  const params = new URLSearchParams({ format: "jsonv2", q: query, limit: "5", addressdetails: "0" });
  if (near) {
    const d = 0.6;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((p) => ({ label: p.display_name, lat: Number(p.lat), lng: Number(p.lon) }));
}

export async function reverseGeocode(lat, lng, signal) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      { signal }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

export const directionsUrl = (to) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=two_wheeler`;
