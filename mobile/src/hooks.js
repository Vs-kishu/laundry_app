import { useCallback, useEffect, useRef, useState } from "react";
import api, { errMsg } from "./api";
import { useAuth } from "./AuthContext";
import { getSocket } from "./socket";
import { fetchRoute, haversineKm } from "./geo";

const FALLBACK_CONFIG = {
  store: null,
  slots: ["8:00 AM - 10:00 AM", "10:00 AM - 12:00 PM", "12:00 PM - 2:00 PM", "2:00 PM - 4:00 PM", "4:00 PM - 6:00 PM", "6:00 PM - 8:00 PM"],
  fees: { delivery: 29, freeDeliveryAbove: 299, express: 39 },
  expressEtaMinutes: 45,
  fallback: true,
};
let cachedConfig = null;

// Store pin, radius, slots and fees (GET /store).
export function useStoreConfig() {
  const [config, setConfig] = useState(cachedConfig);
  useEffect(() => {
    if (cachedConfig) return;
    api
      .get("/store")
      .then(({ data }) => {
        cachedConfig = data;
        setConfig(data);
      })
      .catch(() => setConfig(FALLBACK_CONFIG));
  }, []);
  return config;
}

// Road route that only refetches when the destination changes or the origin moved >150 m.
export function useRoute(from, to) {
  const [route, setRoute] = useState(null);
  const last = useRef({ from: null, to: null, at: 0 });
  const fLat = from?.lat, fLng = from?.lng, tLat = to?.lat, tLng = to?.lng;

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
    if (sameDest && Date.now() - prev.at < 10000) return;
    last.current = { from: a, to: b, at: Date.now() };
    const ctrl = new AbortController();
    fetchRoute(a, b, ctrl.signal).then((pts) => {
      if (!ctrl.signal.aborted) setRoute(pts || [[a.lat, a.lng], [b.lat, b.lng]]);
    });
    return () => ctrl.abort();
  }, [fLat, fLng, tLat, tLng]);

  return route;
}

// Loads an order and keeps it live via sockets (with polling while disconnected).
export function useOrderTracking(orderId) {
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const partnerRef = useRef(undefined);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      if (!alive.current) return;
      setOrder(data);
      setError("");
      const pid = data.partner?._id || null;
      if (pid !== partnerRef.current) {
        partnerRef.current = pid;
        const loc = data.partner?.location;
        setLive(loc ? { lat: loc.lat, lng: loc.lng, stale: true } : null);
      }
    } catch (err) {
      if (alive.current) setError(errMsg(err, "Couldn't load this order."));
    }
  }, [orderId]);

  useEffect(() => {
    alive.current = true;
    load();
    const socket = getSocket(token);
    if (!socket) return () => { alive.current = false; };

    const join = () => {
      setConnected(true);
      socket.emit("order:join", orderId);
      load();
    };
    const onDisc = () => setConnected(false);
    const onUpdate = (e) => e.orderId === orderId && load();
    const onLoc = (e) => e.orderId === orderId && setLive(e);
    socket.on("connect", join);
    socket.on("disconnect", onDisc);
    socket.on("order:update", onUpdate);
    socket.on("partner:location", onLoc);
    if (socket.connected) join();
    const poll = setInterval(() => !socket.connected && load(), 15000);

    return () => {
      alive.current = false;
      clearInterval(poll);
      socket.emit("order:leave", orderId);
      socket.off("connect", join);
      socket.off("disconnect", onDisc);
      socket.off("order:update", onUpdate);
      socket.off("partner:location", onLoc);
    };
  }, [orderId, token, load]);

  return { order, live, error, connected, reload: load };
}
