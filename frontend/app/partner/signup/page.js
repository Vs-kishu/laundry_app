"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { errMsg } from "../../../lib/api";
import AuthShell from "../../../components/AuthShell";
import { Alert, Field } from "../../../components/ui";

const VEHICLES = [
  ["bike", "Motorbike"],
  ["scooter", "Scooter"],
  ["ev", "Electric scooter"],
  ["cycle", "Bicycle"],
];

export default function PartnerSignupPage() {
  const { partnerSignup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    vehicleType: "scooter",
    vehicleNumber: "",
    licenseNumber: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await partnerSignup(form);
      router.push("/partner");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Become a delivery partner"
      subtitle="Apply in two minutes. We verify your details before you can go online."
      aside={{
        title: "Earn by riding around your city.",
        points: [
          ["bolt", "Accept nearby pickups and deliveries"],
          ["nav", "One-tap navigation to every stop"],
          ["wallet", "Earn for every completed task"],
        ],
      }}
      footer={
        <>
          Already a partner? <Link href="/partner/login" className="font-semibold text-link hover:underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <input id="name" name="name" autoComplete="name" value={form.name} onChange={set} required minLength={2} className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={set} required className="input" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set} required className="input" />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set} required className="input" />
        </Field>

        <fieldset className="space-y-4 rounded-2xl border border-line p-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Vehicle &amp; ID</legend>
          <Field label="Vehicle type" htmlFor="vehicleType">
            <select id="vehicleType" name="vehicleType" value={form.vehicleType} onChange={set} className="input">
              {VEHICLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle number" htmlFor="vehicleNumber">
              <input id="vehicleNumber" name="vehicleNumber" value={form.vehicleNumber} onChange={set} required minLength={4} className="input uppercase" placeholder="DL01AB1234" />
            </Field>
            <Field label="Licence / ID number" htmlFor="licenseNumber">
              <input id="licenseNumber" name="licenseNumber" value={form.licenseNumber} onChange={set} required minLength={5} className="input uppercase" />
            </Field>
          </div>
        </fieldset>

        {error && <Alert>{error}</Alert>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full py-3.5">
          {loading ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </AuthShell>
  );
}
