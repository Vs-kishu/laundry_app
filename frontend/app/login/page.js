"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push("/book");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-ink/70">Log in to book a pickup or check your order status.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ink/70" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-soap px-6 py-3 text-canvas hover:bg-soapDark transition-colors disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/70">
        New to Basin?{" "}
        <Link href="/signup" className="text-soap hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
