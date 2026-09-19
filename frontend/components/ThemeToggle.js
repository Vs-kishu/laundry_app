"use client";

import { useEffect, useState } from "react";
import Icon from "./Icons";

// The initial theme is applied by an inline script in layout.js (no flash); this only toggles.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-soft"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}
