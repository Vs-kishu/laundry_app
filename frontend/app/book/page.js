"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const slots = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
];

export default function BookPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState(slots[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.address) setPickupAddress(user.address);
  }, [user]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data } = await api.get("/services");
        setServices(data);
      } catch (err) {
        setError("Couldn't load services. Please refresh the page.");
      }
    };
    fetchServices();
  }, []);

  const updateQuantity = (serviceId, value) => {
    const qty = Math.max(0, Number(value) || 0);
    setQuantities({ ...quantities, [serviceId]: qty });
  };

  const selectedItems = services
    .filter((s) => quantities[s._id] > 0)
    .map((s) => ({
      serviceId: s._id,
      name: s.name,
      unit: s.unit,
      pricePerUnit: s.pricePerUnit,
      quantity: quantities[s._id],
      subtotal: quantities[s._id] * s.pricePerUnit,
    }));

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedItems.length === 0) {
      setError("Please add at least one item to your order.");
      return;
    }
    if (!pickupAddress || !pickupDate) {
      setError("Please fill in your pickup address and date.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/orders", {
        items: selectedItems.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
        pickupAddress,
        pickupDate,
        pickupSlot,
        notes,
      });
      setSuccess(true);
      setQuantities({});
      setTimeout(() => router.push("/orders"), 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Book a pickup</h1>
      <p className="mt-2 text-sm text-ink/70">Choose your items, set a pickup window, and you're done.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        {/* Services */}
        <div>
          <h2 className="font-display text-xl text-ink">Choose your items</h2>
          <div className="mt-4 space-y-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10">
            {services.map((service) => (
              <div key={service._id} className="flex items-center justify-between bg-canvas p-4">
                <div>
                  <p className="text-ink">{service.name}</p>
                  <p className="text-sm text-ink/60">
                    ₹{service.pricePerUnit} / {service.unit}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  value={quantities[service._id] || ""}
                  onChange={(e) => updateQuantity(service._id, e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-ink/20 bg-canvas px-3 py-2 text-center text-ink focus:border-soap"
                />
              </div>
            ))}
            {services.length === 0 && (
              <p className="bg-canvas p-4 text-sm text-ink/60">Loading services…</p>
            )}
          </div>
        </div>

        {/* Pickup details */}
        <div>
          <h2 className="font-display text-xl text-ink">Pickup details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm text-ink/70" htmlFor="address">Pickup address</label>
              <textarea
                id="address"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                required
                rows={2}
                className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-ink/70" htmlFor="date">Pickup date</label>
                <input
                  id="date"
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
                />
              </div>
              <div>
                <label className="text-sm text-ink/70" htmlFor="slot">Time window</label>
                <select
                  id="slot"
                  value={pickupSlot}
                  onChange={(e) => setPickupSlot(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
                >
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-ink/70" htmlFor="notes">Notes for the driver (optional)</label>
              <input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. gate code, leave with security"
                className="mt-1 w-full rounded-lg border border-ink/20 bg-canvas px-4 py-2.5 text-ink focus:border-soap"
              />
            </div>
          </div>
        </div>

        {/* Order summary */}
        {selectedItems.length > 0 && (
          <div className="rounded-2xl border border-ink/10 bg-bubble/50 p-5">
            <h3 className="font-display text-lg text-ink">Order summary</h3>
            <div className="mt-3 space-y-1 text-sm">
              {selectedItems.map((item) => (
                <div key={item.serviceId} className="flex justify-between text-ink/80">
                  <span>{item.name} × {item.quantity} {item.unit}</span>
                  <span>₹{item.subtotal}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 font-display text-lg text-ink">
              <span>Total</span>
              <span>₹{totalAmount}</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-rust">{error}</p>}
        {success && <p className="text-sm text-soap">Order placed! Redirecting to your orders…</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-rust px-6 py-3 text-canvas hover:bg-rust/90 transition-colors disabled:opacity-60"
        >
          {submitting ? "Placing order…" : "Confirm pickup"}
        </button>
      </form>
    </div>
  );
}
