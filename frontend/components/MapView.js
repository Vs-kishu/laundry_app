"use client";

// Imperative Leaflet wrapper. Loaded only in the browser via ./Map (dynamic, ssr: false).
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const GLYPH = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8M5 10v10h14V10"/></svg>',
  store:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/></svg>',
  draft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>',
  rider:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h5l3-7h3l1 7M9 6h3l2 4"/></svg>',
};

const iconFor = (kind) =>
  kind === "rider"
    ? L.divIcon({ className: "lp-marker", html: `<div class="lp-rider">${GLYPH.rider}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] })
    : L.divIcon({
        className: "lp-marker",
        html: `<div class="lp-pin ${kind}">${GLYPH[kind] || GLYPH.home}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 48], // tip of the rotated pin
      });

// Default: OpenStreetMap's public tile server (no key, but fair-use only - see
// https://operations.osmfoundation.org/policies/tiles/). For production traffic set
// NEXT_PUBLIC_MAP_TILE_URL / NEXT_PUBLIC_MAP_ATTRIBUTION to a provider such as MapTiler, Stadia or Mapbox.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * markers: [{ id, lat, lng, kind: 'home'|'store'|'rider'|'draft', label?, draggable? }]
 * route:   [[lat, lng], ...]
 * circle:  { lat, lng, radiusKm }
 * fitKey:  change it to re-fit the viewport to everything (markers move without re-fitting)
 */
export default function MapView({
  markers = [],
  route = null,
  circle = null,
  fitKey = "",
  className = "h-full w-full",
  onMapClick,
  onMarkerDragEnd,
  scrollZoom = false,
  label = "Map",
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map());
  const routeRef = useRef(null);
  const circleRef = useRef(null);
  const cb = useRef({});
  cb.current = { onMapClick, onMarkerDragEnd };
  const fittedKey = useRef(null);

  // init once
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: false, scrollWheelZoom: scrollZoom, attributionControl: true }).setView(
      [20.59, 78.96],
      5
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    // Dark mode recolours these tiles with a CSS filter (see globals.css), so one tile source serves both themes.
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);

    map.on("click", (e) => cb.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers: create / move / remove
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();

    markers.forEach((m) => {
      seen.add(m.id);
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        return;
      }
      const marker = L.marker([m.lat, m.lng], {
        icon: iconFor(m.kind),
        draggable: !!m.draggable,
        title: m.label,
        keyboard: false,
      }).addTo(map);
      if (m.label) marker.bindTooltip(m.label, { direction: "top", offset: [0, -44] });
      if (m.kind === "rider") marker.getElement()?.classList.add("lp-smooth");
      if (m.draggable) {
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          cb.current.onMarkerDragEnd?.(m.id, { lat: p.lat, lng: p.lng });
        });
      }
      markerRefs.current.set(m.id, marker);
    });

    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers]);

  // route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (route && route.length > 1) {
      routeRef.current = L.polyline(route, { color: "#2F6BFF", weight: 5, opacity: 0.85, dashArray: "1 10", lineCap: "round" }).addTo(map);
    }
  }, [route]);

  // service-area circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
    if (circle) {
      circleRef.current = L.circle([circle.lat, circle.lng], {
        radius: circle.radiusKm * 1000,
        color: "#12C2B5",
        weight: 1.5,
        fillColor: "#12C2B5",
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(map);
    }
  }, [circle?.lat, circle?.lng, circle?.radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit the viewport when fitKey changes (and once when the first markers appear)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markers.length) return;
    if (fittedKey.current === fitKey) return;
    fittedKey.current = fitKey;

    const pts = markers.map((m) => [m.lat, m.lng]);
    if (route?.length) pts.push(...route);
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, markers.length]);

  return <div ref={elRef} className={className} role="application" aria-label={label} />;
}
