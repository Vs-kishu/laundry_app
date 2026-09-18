"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-ink/10 bg-canvas">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-2xl tracking-tight text-ink">
          Basin
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#services" className="text-ink/70 hover:text-ink">
            Services
          </Link>

          {user ? (
            <>
              <Link href="/book" className="text-ink/70 hover:text-ink">
                Book a pickup
              </Link>
              <Link href="/orders" className="text-ink/70 hover:text-ink">
                My orders
              </Link>
              <button
                onClick={logout}
                className="rounded-full border border-ink/20 px-4 py-1.5 text-ink hover:bg-ink hover:text-canvas transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-ink/70 hover:text-ink">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-soap px-4 py-1.5 text-canvas hover:bg-soapDark transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
