import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import LeafletMap from "./LeafletMap";
import { Button } from "./ui";
import { reverseGeocode, searchPlaces } from "../geo";
import { colors, radius } from "../theme";

// Search box + "use my location" + tap/drag pin. onChange({ lat, lng, address? }).
export default function LocationPicker({ value, onChange, store }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const skip = useRef(false);

  const markers = useMemo(() => {
    const m = [];
    if (store) m.push({ id: "store", kind: "store", lat: store.location.lat, lng: store.location.lng });
    if (value) m.push({ id: "you", kind: "draft", lat: value.lat, lng: value.lng, draggable: true });
    return m;
  }, [store, value]);

  const pick = async (point, address) => {
    onChange({ ...point, address });
    if (address == null) {
      const a = await reverseGeocode(point.lat, point.lng);
      if (a) onChange({ ...point, address: a });
    }
  };

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (query.trim().length < 3) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query, store?.location, ctrl.signal));
      } catch {}
      setSearching(false);
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, store]);

  const useMyLocation = async () => {
    setGeoError("");
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("denied");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      pick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setGeoError("Couldn't get your location. Allow location access, or search / tap on the map.");
    }
    setLocating(false);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your area, building or landmark"
          placeholderTextColor="#9AA6C3"
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15, color: colors.ink }}
        />
        {searching && <ActivityIndicator size="small" color={colors.brand} />}
      </View>

      {results.length > 0 && (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginTop: 6 }}>
          {results.map((r, i) => (
            <Pressable
              key={i}
              onPress={() => {
                skip.current = true;
                setQuery("");
                setResults([]);
                pick({ lat: r.lat, lng: r.lng }, r.label);
              }}
              style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
            >
              <Ionicons name="location" size={16} color={colors.brand} style={{ marginTop: 2 }} />
              <Text numberOfLines={2} style={{ flex: 1, color: colors.ink, fontSize: 13 }}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <Button title={locating ? "Locating…" : "Use my current location"} icon="locate" variant="secondary" small onPress={useMyLocation} disabled={locating} />
      </View>
      {geoError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{geoError}</Text> : null}

      <View style={{ height: 260, marginTop: 12 }}>
        <LeafletMap
          style={{ flex: 1 }}
          markers={markers}
          circle={store ? { lat: store.location.lat, lng: store.location.lng, radiusKm: store.serviceRadiusKm } : null}
          fitKey={value ? "picked" : "store"}
          onMapClick={(p) => pick(p)}
          onMarkerDragEnd={(id, p) => id === "you" && pick(p)}
        />
        {!value && (
          <View pointerEvents="none" style={{ position: "absolute", top: 10, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ backgroundColor: "rgba(11,27,58,.85)", color: "#fff", fontSize: 12, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, overflow: "hidden" }}>
              Tap the map to drop a pin
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
