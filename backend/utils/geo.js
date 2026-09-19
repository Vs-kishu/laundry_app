const toRad = (d) => (d * Math.PI) / 180;

// Great-circle distance in km.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough city ETA: straight-line distance * road factor at an average scooter speed.
function etaMinutes(km) {
  return Math.max(1, Math.ceil(((km * 1.35) / 22) * 60));
}

const validCoord = (p) =>
  !!p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

module.exports = { haversineKm, etaMinutes, validCoord };
