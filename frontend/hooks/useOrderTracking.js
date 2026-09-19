"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api, { errMsg } from "../lib/api";
import { getSocket } from "../lib/socket";

// Loads an order and keeps it live:
//  - socket "order:update"      -> refetch (status / partner changed)
//  - socket "partner:location"  -> live position + ETA for the map
//  - falls back to polling while the socket is disconnected
export default function useOrderTracking(orderId, enabled = true) {
  const [order, setOrder] = useState(null);
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const alive = useRef(true);
  const partnerRef = useRef(undefined);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      if (!alive.current) return;
      setOrder(data);
      setError("");
      // A different partner (e.g. pickup -> delivery leg) invalidates the previous position.
      // Seed the map with their last persisted position until a live ping arrives.
      const partnerId = data.partner?._id || null;
      if (partnerId !== partnerRef.current) {
        partnerRef.current = partnerId;
        const loc = data.partner?.location;
        setLive(loc ? { lat: loc.lat, lng: loc.lng, stale: true } : null);
      }
    } catch (err) {
      if (alive.current) setError(errMsg(err, "Couldn't load this order."));
    }
  }, [orderId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();

    const socket = getSocket();
    if (!socket) return;

    const join = () => {
      setConnected(true);
      socket.emit("order:join", orderId);
      load(); // catch anything missed while disconnected
    };
    const onDisconnect = () => setConnected(false);
    const onUpdate = (e) => e.orderId === orderId && load();
    const onLocation = (e) => e.orderId === orderId && setLive(e);

    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);
    socket.on("order:update", onUpdate);
    socket.on("partner:location", onLocation);
    if (socket.connected) join();

    const poll = setInterval(() => {
      if (!socket.connected) load();
    }, 15000);

    return () => {
      clearInterval(poll);
      socket.emit("order:leave", orderId);
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.off("order:update", onUpdate);
      socket.off("partner:location", onLocation);
    };
  }, [orderId, enabled, load]);

  return { order, live, error, connected, reload: load };
}
