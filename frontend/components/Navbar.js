"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icons";

function navFor(user) {
  if (!user) {
    return [
      { href: "/#how", label: "How it works" },
      { href: "/#services", label: "Services" },
      { href: "/partner/signup", label: "Become a partner" },
    ];
  }
  if (user.role === "admin") return [{ href: "/admin", label: "Dashboard" }];
  if (user.role === "partner") return [{ href: "/partner", label: "Partner app" }];
  return [
    { href: "/book", label: "Book pickup" },
    { href: "/orders", label: "My orders" },
    { href: "/#services", label: "Services" },
  ];
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const links = navFor(user);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href) => !href.includes("#") && pathname === href;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors ${
        scrolled ? "border-line bg-bg/85" : "border-transparent bg-bg/60"
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Laundry Point home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition hover:bg-soft ${
                isActive(l.href) ? "bg-soft text-link" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden max-w-[10rem] truncate text-sm text-muted lg:block">Hi, {user.name.split(" ")[0]}</span>
              <button onClick={() => logout()} className="btn btn-secondary btn-sm">
                <Icon name="logout" className="h-4 w-4" /> Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link href="/book" className="btn btn-primary btn-sm">
                Book a pickup
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-bg md:hidden">
          <nav aria-label="Mobile" className="container-x flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-soft">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-line pt-3">
              {user ? (
                <button onClick={() => logout()} className="btn btn-secondary w-full">
                  Log out
                </button>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary flex-1">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn btn-primary flex-1">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
