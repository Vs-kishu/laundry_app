/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./hooks/**/*.{js,jsx}"],
  theme: {
    extend: {
      // All colours are CSS variables (see globals.css) so light/dark theming is one switch.
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        soft: token("soft"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        brand: token("brand"),
        "brand-dark": token("brand-dark"),
        link: token("link"),
        aqua: token("aqua"),
        sun: token("sun"),
        danger: token("danger"),
        success: token("success"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 8px 24px -12px rgb(var(--shadow) / 0.12)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 18px 40px -16px rgb(var(--shadow) / 0.25)",
        glow: "0 10px 30px -8px rgb(var(--brand) / 0.55)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        ping2: { "0%": { transform: "scale(0.6)", opacity: "0.7" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        drive: { "0%": { offsetDistance: "0%" }, "100%": { offsetDistance: "100%" } },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        ping2: "ping2 2s cubic-bezier(0,0,0.2,1) infinite",
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fadeUp 0.5s ease-out both",
        drive: "drive 7s linear infinite",
      },
    },
  },
  plugins: [],
};
