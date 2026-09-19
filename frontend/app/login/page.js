"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { roleHome, useAuth } from "../../context/AuthContext";
import { errMsg } from "../../lib/api";
import AuthShell from "../../components/AuthShell";
import { Alert, Field } from "../../components/ui";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      const next = params.get("next");
      // only follow same-site relative paths (prevents open redirects)
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(user.role === "customer" && safeNext ? safeNext : roleHome(user.role));
    } catch (err) {
      setError(errMsg(err, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to book a pickup, track an order or start taking deliveries."
      footer={
        <>
          New to Laundry Point?{" "}
          <Link href="/signup" className="font-semibold text-link hover:underline">Create an account</Link>
          {" · "}
          <Link href="/partner/signup" className="font-semibold text-link hover:underline">Become a partner</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {params.get("expired") && <Alert tone="warn">Your session expired. Please log in again.</Alert>}
        <Field label="Email or mobile number" htmlFor="identifier">
          <input id="identifier" type="text" inputMode="email" autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} required className="input" placeholder="you@example.com or 98765 43210" />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="input" placeholder="Your password" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full py-3.5">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
