import { useId } from "react";

// Laundry Point mark: a location pin whose window is a washing-machine drum, half full of water.
// Says "laundry" and "we come to your location" in one glyph.
export function LogoMark({ size = 36, className = "", title }) {
  const raw = useId().replace(/:/g, "");
  const g = `lp-g-${raw}`;
  const clip = `lp-c-${raw}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <defs>
        <linearGradient id={g} x1="8" y1="3" x2="40" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F6BFF" />
          <stop offset="1" stopColor="#12C2B5" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="24" cy="19.5" r="7.2" />
        </clipPath>
      </defs>
      <path
        d="M24 2.5C14.4 2.5 6.5 10.2 6.5 19.7c0 11.9 14.7 24.1 16.7 25.7.5.4 1.1.4 1.6 0 2-1.6 16.7-13.8 16.7-25.7C41.5 10.2 33.6 2.5 24 2.5Z"
        fill={`url(#${g})`}
      />
      <circle cx="24" cy="19.5" r="10.6" fill="#fff" />
      <circle cx="24" cy="19.5" r="7.2" fill="#EAF2FF" />
      <g clipPath={`url(#${clip})`}>
        <path d="M14 19.4c2.4-2.3 4.4-2.3 6.8 0s4.4 2.3 6.8 0 4.4-2.3 6.4 0V28H14Z" fill={`url(#${g})`} />
      </g>
      <circle cx="24" cy="19.5" r="7.2" stroke="#0B1B3A" strokeOpacity=".12" strokeWidth="1.2" />
      <circle cx="20.6" cy="16.6" r="1.1" fill="#fff" fillOpacity=".9" />
      <circle cx="27.4" cy="22.8" r="0.8" fill="#fff" fillOpacity=".9" />
    </svg>
  );
}

export default function Logo({ className = "", size = 36, showText = true, textClass = "text-xl" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} title={showText ? undefined : "Laundry Point"} />
      {showText && (
        <span className={`font-display font-extrabold leading-none tracking-tight text-ink ${textClass}`}>
          Laundry<span className="gradient-text"> Point</span>
        </span>
      )}
    </span>
  );
}
