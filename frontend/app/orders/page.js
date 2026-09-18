"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const statusLabels = {
  placed: "Placed",
  picked_up: "Picked up",
  in_progress: "In progress",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusColors = {
  placed: "bg-bubble text-ink",
  picked_up: "bg-soap/20 text-soapDark",
  in_progress: "bg-soap/20 text-soapDark",
  ready: "bg-rust/20 text-rust",
  delivered: "bg-soap text-canvas",
  cancelled: "bg-ink/10 text-ink/50",
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const { data } = await api.get("/orders/my");
        setOrders(data);
      } catch (err) {
        setError("Couldn't load your orders. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink">My orders</h1>

      {loading && <p className="mt-6 text-sm text-ink/60">Loading your orders…</p>}
      {error && <p className="mt-6 text-sm text-rust">{error}</p>}

      {!loading && orders.length === 0 && !error && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink/20 p-8 text-center">
          <p className="text-ink/70">You haven't booked a pickup yet.</p>
          <a href="/book" className="mt-3 inline-block text-soap hover:underline">
            Book your first pickup
          </a>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <div key={order._id} className="rounded-2xl border border-ink/10 bg-canvas p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink/60">
                  {new Date(order.pickupDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {order.pickupSlot}
                </p>
                <p className="mt-1 text-ink">
                  {order.items.map((i) => `${i.serviceName} × ${i.quantity}${i.unit}`).join(", ")}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${statusColors[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
              <span className="text-ink/60">{order.pickupAddress}</span>
              <span className="font-display text-base text-ink">₹{order.totalAmount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
