import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Laundry Point - laundry pickup in minutes, tracked live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social-share card generated at request time (also used as the Twitter card).
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "linear-gradient(135deg, #0B1B3A 0%, #1E4FD8 60%, #12C2B5 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 48 48">
            <path
              d="M24 2.5C14.4 2.5 6.5 10.2 6.5 19.7c0 11.9 14.7 24.1 16.7 25.7.5.4 1.1.4 1.6 0 2-1.6 16.7-13.8 16.7-25.7C41.5 10.2 33.6 2.5 24 2.5Z"
              fill="#fff"
            />
            <circle cx="24" cy="19.5" r="8" fill="#2F6BFF" />
            <circle cx="24" cy="19.5" r="5" fill="#fff" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>Laundry Point</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, maxWidth: 950 }}>
          Laundry picked up in minutes. Tracked live.
        </div>
        <div style={{ marginTop: 32, fontSize: 32, opacity: 0.85 }}>
          Pickup partner on a live map - from your door to our store and back.
        </div>
      </div>
    ),
    size
  );
}
