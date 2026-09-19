"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it is loaded client-side only and split into its own chunk
// (pages without a map never download it).
const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full min-h-[200px] w-full" aria-label="Loading map" />,
});

export default Map;
