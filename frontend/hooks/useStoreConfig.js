"use client";

import { useEffect, useState } from "react";
import api from "../lib/api";

// Store pin, service radius, slots and fees from GET /store (cached in module scope).
let cached = null;

const FALLBACK = {
  store: null,
  slots: ["8:00 AM - 10:00 AM", "10:00 AM - 12:00 PM", "12:00 PM - 2:00 PM", "2:00 PM - 4:00 PM", "4:00 PM - 6:00 PM", "6:00 PM - 8:00 PM"],
  fees: { delivery: 29, freeDeliveryAbove: 299, express: 39 },
  expressEtaMinutes: 45,
  fallback: true,
};

export default function useStoreConfig() {
  const [config, setConfig] = useState(cached);

  useEffect(() => {
    if (cached) return;
    api
      .get("/store")
      .then(({ data }) => {
        cached = data;
        setConfig(data);
      })
      // Older/unreachable backend: keep booking usable with sensible defaults (no store pin).
      .catch(() => setConfig(FALLBACK));
  }, []);

  return config;
}
