"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      router.push("/book");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-ink/70">Set up your details once — book pickups in seconds after that.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ink/70" htmlFor="name">Full name</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor="address">Default address (optional)</label>
          <input
            id="address"
            name="address"
            value={form.address}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            value={form.password}
            onChange={handleChange}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/70">
        Already have an account?{" "}
        <Link href="/login" className="text-soap hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
