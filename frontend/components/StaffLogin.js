"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../lib/api";
import { LogoMark } from "./Logo";
import Icon from "./Icons";
import { Alert } from "./ui";

const CFG = {
  admin: {
    title: "Admin console",
    sub: "Manage orders, partners and the store.",
    icon: "shield",
    bg: "from-[#050D1F] via-[#0B1B3A] to-[#173A8C]",
    home: "/admin",
    demo: { email: "admin@laundrypoint.local", password: "Admin@12345" },
  },
  partner: {
    title: "Driver login",
    sub: "Go online and start earning on pickups and deliveries.",
    icon: "bike",
    bg: "from-[#062F33] via-[#0B6E6A] to-[#12A594]",
    home: "/partner",
    demo: { email: "rider@laundrypoint.local", password: "Rider@12345" },
  },
};

// Full-screen sign-in for staff. Rejects accounts that don't have the matching role.
export default function StaffLogin({ role }) {
  const c = CFG[role];
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dev = process.env.NODE_ENV !== "production";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      if (user.role !== role) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setError(`This account isn't ${role === "admin" ? "an admin" : "a driver"} account.`);
        setLoading(false);
        // leave the just-created session state consistent
        window.location.reload();
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith(c.home) ? next : c.home);
    } catch (err) {
      setError(errMsg(err, "Invalid email or password."));
      setLoading(false);
    }
  };

  return (
    <div className={`grid min-h-screen place-items-center bg-gradient-to-br ${c.bg} px-4 py-10`}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><LogoMark size={32} /></span>
          <span className="font-display text-xl font-extrabold">Laundry Point</span>
        </div>
        <form onSubmit={submit} className="rounded-3xl bg-white p-7 text-[#0B1B3A] shadow-2xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B1B3A] text-white"><Icon name={c.icon} /></span>
          <h1 className="mt-4 text-2xl font-extrabold">{c.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{c.sub}</p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email or mobile</label>
              <input id="identifier" type="text" required autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2F6BFF] focus:ring-4 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
              <input id="password" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#2F6BFF] focus:ring-4 focus:ring-blue-100" />
            </div>
            {error && <Alert>{error}</Alert>}
            <button type="submit" disabled={loading} className="btn w-full bg-[#0B1B3A] py-3.5 text-white hover:bg-[#12285a]">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>

          {dev && (
            <button type="button" onClick={() => setForm({ identifier: c.demo.email, password: c.demo.password })} className="mt-4 w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:bg-slate-50">
              Dev: fill demo credentials ({c.demo.email})
            </button>
          )}
        </form>
        <p className="mt-5 text-center text-sm text-white/80">
          {role === "partner" ? (
            <>New driver? <Link href="/partner/signup" className="font-semibold underline">Apply here</Link> &middot; </>
          ) : null}
          <Link href="/" className="underline">Back to website</Link>
        </p>
      </div>
    </div>
  );
}
