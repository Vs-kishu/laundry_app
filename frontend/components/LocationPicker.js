"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapCanvas from "./Map";
import Icon from "./Icons";
import { reverseGeocode, searchPlaces } from "../lib/geo";

// Search box + "use my location" + a draggable pin on the map.
// onChange({ lat, lng, address? }) fires whenever the chosen point changes.
export default function LocationPicker({ value, onChange, store }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const skipSearch = useRef(false);

  const markers = useMemo(() => {
    const m = [];
    if (store) m.push({ id: "store", kind: "store", lat: store.location.lat, lng: store.location.lng, label: store.name });
    if (value) m.push({ id: "you", kind: "draft", lat: value.lat, lng: value.lng, label: "Drag to adjust", draggable: true });
    return m;
  }, [store, value]);

  const pick = async (point, address) => {
    onChange({ ...point, address: address ?? undefined });
    if (address == null) {
      const addr = await reverseGeocode(point.lat, point.lng);
      if (addr) onChange({ ...point, address: addr });
    }
  };

  // debounced address search
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query, store?.location, ctrl.signal));
      } catch {
        /* aborted or offline */
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, store]);

  const useMyLocation = () => {
    setGeoError("");
    if (!navigator.geolocation) return setGeoError("Your browser doesn't support location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Allow location access, or search / tap on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your area, building or landmark"
          className="input pl-11"
          aria-label="Search address"
          autoComplete="off"
        />
        {searching && <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
        {results.length > 0 && (
          <ul className="absolute z-[1000] mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-line bg-surface shadow-lift">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-soft"
                  onClick={() => {
                    skipSearch.current = true;
                    setQuery("");
                    setResults([]);
                    pick({ lat: r.lat, lng: r.lng }, r.label);
                  }}
                >
                  <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span className="line-clamp-2">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-secondary btn-sm mt-3">
        <Icon name="locate" className="h-4 w-4" /> {locating ? "Locating…" : "Use my current location"}
      </button>
      {geoError && <p className="mt-2 text-xs text-danger">{geoError}</p>}

      <div className="relative mt-4 h-72 overflow-hidden rounded-3xl border border-line sm:h-80">
        <MapCanvas
          markers={markers}
          circle={store ? { lat: store.location.lat, lng: store.location.lng, radiusKm: store.serviceRadiusKm } : null}
          fitKey={value ? "picked" : "store"}
          onMapClick={(p) => pick(p)}
          onMarkerDragEnd={(id, p) => id === "you" && pick(p)}
          label="Choose pickup location"
        />
        {!value && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
            <span className="rounded-full bg-ink/85 px-4 py-1.5 text-xs font-medium text-bg backdrop-blur">Tap the map to drop a pin</span>
          </div>
        )}
      </div>
    </div>
  );
}
