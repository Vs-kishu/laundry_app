const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Road geometry from the public OSRM demo server (no SLA - callers fall back to a straight line).
export async function fetchRoute(from, to, signal) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const route = (await res.json()).routes?.[0];
    return route ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng]) : null;
  } catch {
    return null;
  }
}

// OpenStreetMap Nominatim (fair use: debounce; identify the app).
const HEADERS = { "User-Agent": "LaundryPointApp/1.0", Accept: "application/json" };

export async function searchPlaces(query, near, signal) {
  const params = new URLSearchParams({ format: "jsonv2", q: query, limit: "5" });
  if (near) {
    const d = 0.6;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: HEADERS });
  if (!res.ok) return [];
  return (await res.json()).map((p) => ({ label: p.display_name, lat: Number(p.lat), lng: Number(p.lon) }));
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`, { headers: HEADERS });
    return res.ok ? (await res.json()).display_name || "" : "";
  } catch {
    return "";
  }
}
