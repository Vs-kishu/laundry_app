"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { errMsg } from "../../lib/api";
import AuthShell from "../../components/AuthShell";
import { Alert, Field } from "../../components/ui";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      router.push("/book");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up once, then book pickups in seconds."
      footer={
        <>
          Already have an account? <Link href="/login" className="font-semibold text-link hover:underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <input id="name" name="name" autoComplete="name" value={form.name} onChange={set} required minLength={2} className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={set} required className="input" />
          </Field>
          <Field label="Mobile number" htmlFor="phone">
            <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set} required className="input" placeholder="98765 43210" />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set} required className="input" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full py-3.5">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
