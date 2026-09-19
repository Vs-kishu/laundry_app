"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRoute, haversineKm } from "../lib/geo";

// Road route between two points. Re-fetches only when the destination changes or the origin
// has moved >150 m (and at most every 10 s), so a moving partner doesn't hammer the router.
// Falls back to a straight line if the routing service is unavailable.
export default function useRoute(from, to) {
  const [route, setRoute] = useState(null);
  const last = useRef({ from: null, to: null, at: 0 });

  const fLat = from?.lat;
  const fLng = from?.lng;
  const tLat = to?.lat;
  const tLng = to?.lng;

  useEffect(() => {
    if (fLat == null || tLat == null) {
      setRoute(null);
      last.current = { from: null, to: null, at: 0 };
      return;
    }
    const a = { lat: fLat, lng: fLng };
    const b = { lat: tLat, lng: tLng };
    const prev = last.current;
    const sameDest = prev.to && prev.to.lat === b.lat && prev.to.lng === b.lng;
    if (sameDest && prev.from && haversineKm(prev.from, a) < 0.15) return;
    if (sameDest && Date.now() - prev.at < 10_000) return;

    last.current = { from: a, to: b, at: Date.now() };
    const ctrl = new AbortController();
    fetchRoute(a, b, ctrl.signal).then((r) => {
      if (!ctrl.signal.aborted) setRoute(r?.points || [[a.lat, a.lng], [b.lat, b.lng]]);
    });
    return () => ctrl.abort();
  }, [fLat, fLng, tLat, tLng]);

  return route;
}
