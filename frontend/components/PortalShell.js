"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icons";

const THEMES = {
  admin: {
    bar: "bg-[#0B1B3A] text-white",
    badge: "bg-sun text-[#0B1B3A]",
    title: "Admin console",
    icon: "shield",
    login: "/admin/login",
  },
  partner: {
    bar: "bg-gradient-to-r from-[#0B6E6A] to-[#12A594] text-white",
    badge: "bg-white/20 text-white",
    title: "Driver app",
    icon: "bike",
    login: "/partner/login",
  },
};

// Own header for the staff portals: different colours and no marketing navigation.
export default function PortalShell({ role, children }) {
  const t = THEMES[role];
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-bg">
      <header className={`sticky top-0 z-50 shadow-lg ${t.bar}`}>
        <div className="container-x flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white"><LogoMark size={26} /></span>
            <div className="leading-tight">
              <p className="font-display text-sm font-extrabold">Laundry Point</p>
              <p className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t.badge}`}>
                <Icon name={t.icon} className="h-3 w-3" /> {t.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && <span className="hidden text-sm text-white/80 sm:block">{user.name}</span>}
            <ThemeToggle />
            <button onClick={() => logout(t.login)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">
              <Icon name="logout" className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
