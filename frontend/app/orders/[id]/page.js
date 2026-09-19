"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api, { errMsg } from "../../../lib/api";
import { useRequireRole } from "../../../context/AuthContext";
import useOrderTracking from "../../../hooks/useOrderTracking";
import useStoreConfig from "../../../hooks/useStoreConfig";
import useRoute from "../../../hooks/useRoute";
import MapCanvas from "../../../components/Map";
import StatusTimeline from "../../../components/StatusTimeline";
import Icon from "../../../components/Icons";
import { Alert, PageLoader } from "../../../components/ui";
import { CUSTOMER_CANCELLABLE_UI, headlineFor, LIVE_STATUSES, STATUS_META } from "../../../lib/constants";
import { money, shortDate } from "../../../lib/format";

function OtpCard({ label, code, who }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun/25 text-ink">
          <Icon name="key" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="text-xs text-muted">Tell it to {who} in person - never over chat or a call.</p>
        </div>
        <div className="flex gap-1.5" aria-label={`${label}: ${code.split("").join(" ")}`}>
          {code.split("").map((d, i) => (
            <span key={i} className="grid h-11 w-9 place-items-center rounded-xl bg-ink font-display text-xl font-extrabold text-bg">
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { id } = useParams();
  const { user, ready } = useRequireRole(["customer", "admin"]);
  const { order, live, error, connected, reload } = useOrderTracking(id, ready);
  const config = useStoreConfig();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const isLive = order && LIVE_STATUSES.includes(order.status);
  const customerPt = order?.pickupLocation;
  const storePt = config?.store?.location;
  const destination = order?.destination === "store" ? storePt : order?.destination === "customer" ? customerPt : null;
  const partnerPt = isLive && live?.lat != null ? { lat: live.lat, lng: live.lng } : null;

  const route = useRoute(partnerPt, destination);

  // arriving from the booking page can leave the viewport scrolled down
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  const markers = useMemo(() => {
    if (!order) return [];
    const m = customerPt ? [{ id: "home", kind: "home", lat: customerPt.lat, lng: customerPt.lng, label: "Your address" }] : []; // legacy orders have no pin
    if (storePt) m.push({ id: "store", kind: "store", lat: storePt.lat, lng: storePt.lng, label: config.store.name });
    if (partnerPt) m.push({ id: "rider", kind: "rider", lat: partnerPt.lat, lng: partnerPt.lng, label: order.partner?.name || "Partner" });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id, storePt?.lat, storePt?.lng, partnerPt?.lat, partnerPt?.lng, order?.partner?.name]);

  const cancel = async () => {
    if (!window.confirm("Cancel this order?")) return;
    setBusy(true);
    setActionError("");
    try {
      await api.put(`/orders/${id}/cancel`);
      await reload();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <PageLoader />;
  if (error && !order) {
    return (
      <div className="container-x max-w-xl py-16">
        <Alert>{error}</Alert>
        <Link href="/orders" className="btn btn-secondary mt-6">Back to my orders</Link>
      </div>
    );
  }
  if (!order) return <PageLoader />;

  const headline = headlineFor(order, live);
  const showMap = order.status !== "cancelled";
  const canCancel = user?.role === "customer" && CUSTOMER_CANCELLABLE_UI.includes(order.status);
  const eta = isLive && live?.etaMinutes;

  return (
    <div className="container-x max-w-6xl py-8">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <Icon name="chevron" className="h-4 w-4 rotate-180" /> My orders
      </Link>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ---------- left: headline + map ---------- */}
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0B1B3A] via-[#1E4FD8] to-[#12C2B5] p-6 text-white sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{order.orderNumber}</p>
                <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl" aria-live="polite">
                  {headline.title}
                </h1>
                <p className="mt-2 text-sm text-white/80">{headline.sub}</p>
              </div>
              {eta ? (
                <div className="shrink-0 rounded-2xl bg-white px-4 py-3 text-center text-[#0B1B3A] shadow-lift">
                  <p className="font-display text-3xl font-extrabold leading-none">{eta}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide">min</p>
                </div>
              ) : (
                <span className="chip bg-white/95 text-[#0B1B3A]">{STATUS_META[order.status]?.short}</span>
              )}
            </div>
            {isLive && (
              <p className="relative mt-5 flex items-center gap-2 text-xs text-white/80">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`} />
                {connected ? "Live updates on" : "Reconnecting - refreshing every few seconds"}
                {live?.distanceKm != null && <span>&middot; {live.distanceKm} km away</span>}
              </p>
            )}
          </div>

          {showMap && (
            <div className="card relative h-[340px] overflow-hidden sm:h-[440px]">
              <MapCanvas
                markers={markers}
                route={partnerPt ? route : null}
                fitKey={`${order.status}|${partnerPt ? "live" : "wait"}|${route ? "r" : ""}`}
                label="Live delivery map"
              />
              {isLive && !partnerPt && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center px-4">
                  <span className="rounded-full bg-ink/85 px-4 py-2 text-xs font-medium text-bg backdrop-blur">
                    Waiting for {order.partner?.name?.split(" ")[0] || "your partner"}&apos;s location…
                  </span>
                </div>
              )}
            </div>
          )}

          {order.otp?.pickup && <OtpCard label="Pickup OTP" code={order.otp.pickup} who="your pickup partner" />}
          {order.otp?.delivery && <OtpCard label="Delivery OTP" code={order.otp.delivery} who="your delivery partner" />}

          {order.partner && (
            <div className="card flex items-center gap-4 p-5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand to-aqua font-bold text-white">
                {order.partner.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{order.partner.name}</p>
                <p className="text-sm capitalize text-muted">
                  {order.leg === "pickup" ? "Pickup partner" : "Delivery partner"} &middot; {order.partner.vehicleType}
                  {order.partner.vehicleNumber ? ` · ${order.partner.vehicleNumber}` : ""}
                </p>
              </div>
              <a href={`tel:${order.partner.phone}`} className="btn btn-secondary btn-sm" aria-label={`Call ${order.partner.name}`}>
                <Icon name="phone" className="h-4 w-4" /> Call
              </a>
            </div>
          )}
        </div>

        {/* ---------- right: details ---------- */}
        <div className="space-y-5">
          <div className="card p-6">
            <h2 className="mb-5 text-lg font-bold">Progress</h2>
            {order.status === "cancelled" ? (
              <Alert tone="warn">This order was cancelled.</Alert>
            ) : (
              <StatusTimeline order={order} />
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">Order details</h2>
            <ul className="space-y-2 text-sm">
              {order.items.map((i) => (
                <li key={i.service} className="flex justify-between gap-3">
                  <span className="text-muted">{i.serviceName} &times; {i.quantity} {i.unit}</span>
                  <span className="font-medium">{money(i.subtotal)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-line pt-2 text-muted">
                <span>Delivery</span>
                <span>{order.deliveryFee ? money(order.deliveryFee) : "FREE"}</span>
              </li>
              {order.expressFee > 0 && (
                <li className="flex justify-between text-muted">
                  <span>Express pickup</span>
                  <span>{money(order.expressFee)}</span>
                </li>
              )}
              <li className="flex justify-between border-t border-line pt-3 text-base font-bold">
                <span>Total</span>
                <span>{money(order.totalAmount)}</span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted">
              {order.paymentStatus === "paid" ? "Paid on delivery" : "Pay on delivery"}
            </p>

            <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
              <p className="flex gap-2">
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{order.pickupAddress}</span>
              </p>
              <p className="flex gap-2 text-muted">
                <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{order.pickupType === "express" ? "Express pickup" : `${shortDate(order.pickupDate)} · ${order.pickupSlot}`}</span>
              </p>
              {order.notes && <p className="rounded-xl bg-soft px-3 py-2 text-muted">&ldquo;{order.notes}&rdquo;</p>}
            </div>
          </div>

          {canCancel && (
            <div>
              {actionError && <div className="mb-3"><Alert>{actionError}</Alert></div>}
              <button onClick={cancel} disabled={busy} className="btn btn-danger w-full">
                {busy ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
