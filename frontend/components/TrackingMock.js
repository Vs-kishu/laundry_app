import Icon from "./Icons";

// Decorative "live tracking" card for the hero: a stylised map with a rider driving the route.
export default function TrackingMock({ className = "" }) {
  const route = "M52 178 C118 178 108 108 176 110 S268 72 316 46";
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-brand/25 via-aqua/20 to-transparent blur-2xl" />

      <div className="card relative overflow-hidden shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Order LP-4F2A</p>
            <p className="font-display text-base font-bold">Rahul is 6 min away</p>
          </div>
          <span className="chip bg-success/15 text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-success" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>

        <svg viewBox="0 0 360 220" className="block w-full bg-soft">
          <g className="stroke-line" strokeWidth="14" fill="none" strokeLinecap="round">
            <path d="M0 150 H360 M0 70 H360 M90 0 V220 M230 0 V220" />
          </g>
          <g className="stroke-surface" strokeWidth="9" fill="none" strokeLinecap="round">
            <path d="M0 150 H360 M0 70 H360 M90 0 V220 M230 0 V220" />
          </g>
          <rect x="112" y="86" width="96" height="48" rx="10" className="fill-aqua/15" />
          <rect x="250" y="88" width="80" height="46" rx="10" className="fill-brand/10" />
          <rect x="14" y="88" width="58" height="46" rx="10" className="fill-sun/20" />

          <path d={route} fill="none" stroke="#2F6BFF" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 10" />

          {/* store */}
          <g transform="translate(52 178)">
            <circle r="15" fill="#F59E0B" stroke="#fff" strokeWidth="3" />
            <path d="M-6 -2h12v7h-12zM-7 -2l1.500-5h11l1.500 5" fill="none" stroke="#fff" strokeWidth="1.800" strokeLinejoin="round" />
          </g>
          {/* home */}
          <g transform="translate(316 46)">
            <circle r="15" fill="#2F6BFF" stroke="#fff" strokeWidth="3" />
            <path d="M-7 1 0 -6l7 7M-5 0v6h10v-6" fill="none" stroke="#fff" strokeWidth="1.800" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {/* rider */}
          <g>
            <animateMotion dur="9s" repeatCount="indefinite" path={route} />
            <circle r="17" fill="none" stroke="#12C2B5" strokeWidth="2" opacity=".6">
              <animate attributeName="r" values="12;24" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".7;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle r="14" fill="#0B1B3A" stroke="#fff" strokeWidth="3" />
            <circle cx="-5" cy="3.500" r="2.200" fill="none" stroke="#fff" strokeWidth="1.500" />
            <circle cx="5" cy="3.500" r="2.200" fill="none" stroke="#fff" strokeWidth="1.500" />
            <path d="M-5 3.500h4l2-5h2.500" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" />
          </g>
        </svg>

        <div className="flex items-center gap-3 px-5 py-4">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand to-aqua font-bold text-white">R</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Rahul K. &middot; Scooter</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Icon name="star" className="h-3.5 w-3.5 text-sun" /> 4.9 &middot; 1,240 pickups
            </p>
          </div>
          <div className="rounded-2xl bg-soft px-3 py-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pickup OTP</p>
            <p className="font-display text-lg font-extrabold tracking-[0.2em] text-link">4821</p>
          </div>
        </div>
      </div>
    </div>
  );
}
