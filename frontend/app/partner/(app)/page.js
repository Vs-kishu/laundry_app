"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { errMsg } from "../../../lib/api";
import { useAuth, useRequireRole } from "../../../context/AuthContext";
import { closeSocket, getSocket } from "../../../lib/socket";
import { directionsUrl, haversineKm } from "../../../lib/geo";
import { money, timeOnly } from "../../../lib/format";
import useStoreConfig from "../../../hooks/useStoreConfig";
import useRoute from "../../../hooks/useRoute";
import MapCanvas from "../../../components/Map";
import Icon from "../../../components/Icons";
import { Alert, EmptyState, PageLoader, StatusChip } from "../../../components/ui";

const NEXT_ACTION = {
  pickup_assigned: { dest: "customer", label: "Picked up", needsOtp: true, hint: "Ask the customer for their 4-digit pickup OTP", go: "Navigate to customer" },
  picked_up: { dest: "store", label: "Reached store - handed over", needsOtp: false, hint: "Hand the clothes to store staff", go: "Navigate to store" },
  delivery_assigned: { dest: "store", label: "Collected from store - start delivery", needsOtp: false, hint: "Collect the clean clothes at the store", go: "Navigate to store" },
  out_for_delivery: { dest: "customer", label: "Delivered", needsOtp: true, hint: "Ask the customer for their 4-digit delivery OTP and collect cash", go: "Navigate to customer" },
};

const DEV = process.env.NODE_ENV !== "production";

export default function PartnerPage() {
  const { ready } = useRequireRole(["partner"], "/partner/login");
  const { user, refreshUser } = useAuth();
  const config = useStoreConfig();

  const approved = user?.partner?.verificationStatus === "approved";
  const [online, setOnline] = useState(false);
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState({ active: [], history: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [myPos, setMyPos] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [simulate, setSimulate] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [otp, setOtp] = useState("");
  const [loaded, setLoaded] = useState(false);
  const simPos = useRef(null);

  useEffect(() => {
    if (user?.partner) setOnline(!!user.partner.isOnline);
  }, [user?.partner?.isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- data ----------
  const loadTasks = useCallback(async () => {
    if (!approved) return;
    try {
      const [a, m] = await Promise.all([api.get("/partner/tasks/available"), api.get("/partner/tasks/mine")]);
      setAvailable(a.data);
      setMine(m.data);
      setLoaded(true);
    } catch (err) {
      setError(errMsg(err, "Couldn't refresh tasks."));
    }
  }, [approved]);

  useEffect(() => {
    if (!ready || !approved) return;
    loadTasks();

    // Reconnect so this socket joins the "partners" room (approval may be newer than the connection).
    closeSocket();
    const socket = getSocket();
    socket?.on("tasks:changed", loadTasks);
    socket?.on("order:update", loadTasks);
    const poll = setInterval(loadTasks, 30000);
    return () => {
      clearInterval(poll);
      socket?.off("tasks:changed", loadTasks);
      socket?.off("order:update", loadTasks);
    };
  }, [ready, approved, loadTasks]);

  // pending partners: poll for approval
  useEffect(() => {
    if (!ready || approved) return;
    const t = setInterval(() => refreshUser().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [ready, approved, refreshUser]);

  // keep a valid selected task
  useEffect(() => {
    if (!mine.active.find((t) => t._id === selectedId)) setSelectedId(mine.active[0]?._id || null);
  }, [mine.active, selectedId]);

  const selected = mine.active.find((t) => t._id === selectedId) || null;
  const action = selected ? NEXT_ACTION[selected.status] : null;
  const storePt = config?.store?.location;
  const destination = selected && action ? (action.dest === "store" ? storePt : selected.pickupLocation) || null : null;

  // ---------- GPS -> socket ----------
  const emit = useCallback((p) => getSocket()?.emit("partner:location", p), []);

  useEffect(() => {
    if (!approved || !online || simulate) return;
    if (!navigator.geolocation) {
      setGpsError("This device doesn't support GPS.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError("");
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading };
        setMyPos(p);
        emit(p);
      },
      (err) => setGpsError(err.code === 1 ? "Location permission denied - allow it so customers can track you." : "Can't get a GPS fix yet…"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [approved, online, simulate, emit]);

  // Dev-only: glide toward the current destination so the whole flow can be tested at a desk.
  useEffect(() => {
    if (!DEV || !simulate || !online) return;
    const t = setInterval(() => {
      const target = destination;
      if (!simPos.current) simPos.current = myPos || storePt;
      if (!simPos.current) return;
      if (target) {
        const d = haversineKm(simPos.current, target);
        const stepKm = 0.06;
        const f = d <= stepKm ? 1 : stepKm / d;
        simPos.current = {
          lat: simPos.current.lat + (target.lat - simPos.current.lat) * f,
          lng: simPos.current.lng + (target.lng - simPos.current.lng) * f,
        };
      }
      setMyPos(simPos.current);
      emit(simPos.current);
    }, 1000);
    return () => clearInterval(t);
  }, [simulate, online, destination?.lat, destination?.lng, storePt?.lat, storePt?.lng, emit]); // eslint-disable-line react-hooks/exhaustive-deps

  const route = useRoute(myPos, destination);

  const markers = useMemo(() => {
    const m = [];
    if (storePt) m.push({ id: "store", kind: "store", lat: storePt.lat, lng: storePt.lng, label: "Store" });
    if (selected?.pickupLocation) m.push({ id: "home", kind: "home", lat: selected.pickupLocation.lat, lng: selected.pickupLocation.lng, label: selected.customer?.name || "Customer" });
    if (myPos) m.push({ id: "me", kind: "rider", lat: myPos.lat, lng: myPos.lng, label: "You" });
    return m;
  }, [storePt?.lat, storePt?.lng, selected?._id, selected?.pickupLocation?.lat, myPos?.lat, myPos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- actions ----------
  const toggleOnline = async () => {
    setError("");
    try {
      const { data } = await api.put("/partner/status", { online: !online });
      setOnline(data.isOnline);
      if (!data.isOnline) {
        setMyPos(null);
        setSimulate(false);
      }
      await refreshUser();
      loadTasks();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const accept = async (task) => {
    setBusyId(task.orderId);
    setError("");
    try {
      const { data } = await api.post(`/partner/tasks/${task.orderId}/accept`, { leg: task.leg });
      setSelectedId(data._id);
      await loadTasks();
    } catch (err) {
      setError(errMsg(err));
      loadTasks();
    } finally {
      setBusyId(null);
    }
  };

  const advance = async () => {
    if (!selected || !action) return;
    if (action.needsOtp && !/^\d{4}$/.test(otp)) return setError("Enter the customer's 4-digit OTP.");
    setBusyId(selected._id);
    setError("");
    try {
      await api.post(`/partner/tasks/${selected._id}/advance`, action.needsOtp ? { otp } : {});
      setOtp("");
      await Promise.all([loadTasks(), refreshUser()]);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return <PageLoader />;
  const status = user?.partner?.verificationStatus;

  return (
    <div className="container-x max-w-6xl py-8">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Hi, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm capitalize text-muted">
            {user.partner?.vehicleType} &middot; {user.partner?.vehicleNumber}
          </p>
        </div>

        {approved && (
          <button
            onClick={toggleOnline}
            role="switch"
            aria-checked={online}
            className={`flex items-center gap-3 rounded-full border px-5 py-2.5 font-semibold transition ${online ? "border-success/40 bg-success/10 text-success" : "border-line bg-surface text-muted"}`}
          >
            <span className={`relative h-6 w-11 rounded-full transition ${online ? "bg-success" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${online ? "left-[22px]" : "left-0.5"}`} />
            </span>
            {online ? "You're online" : "You're offline"}
          </button>
        )}
      </div>

      {status !== "approved" && (
        <div className="mt-8">
          <div className="card p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sun/25 text-ink">
              <Icon name={status === "rejected" ? "alert" : "shield"} className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold">{status === "rejected" ? "Application not approved" : "Your application is under review"}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {status === "rejected"
                ? "We couldn't verify your details. Please contact support to update your information."
                : "We're verifying your vehicle and licence details. You'll be able to go online as soon as you're approved - this page updates automatically."}
            </p>
            <button onClick={() => refreshUser()} className="btn btn-secondary mt-5">
              <Icon name="refresh" className="h-4 w-4" /> Check status
            </button>
          </div>
        </div>
      )}

      {approved && (
        <>
          {/* ---------- stats ---------- */}
          <dl className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Tasks done", user.partner.completedTasks],
              ["Earnings", money(user.partner.earnings)],
              ["Active now", mine.active.length],
            ].map(([k, v]) => (
              <div key={k} className="card p-4 text-center">
                <dd className="font-display text-2xl font-extrabold">{v}</dd>
                <dt className="mt-0.5 text-xs text-muted">{k}</dt>
              </div>
            ))}
          </dl>

          {error && <div className="mt-5"><Alert>{error}</Alert></div>}
          {online && gpsError && <div className="mt-5"><Alert tone="warn">{gpsError}</Alert></div>}

          {!online && (
            <div className="mt-6">
              <EmptyState icon="bike" title="You're offline">
                Go online to see nearby pickups and deliveries. Your live location is shared with customers only while you have an active task.
              </EmptyState>
            </div>
          )}

          {online && (
            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
              {/* ---------- left: active task + map ---------- */}
              <div className="space-y-5">
                {mine.active.length === 0 ? (
                  <div className="card relative h-[300px] overflow-hidden">
                    <MapCanvas markers={markers} fitKey={myPos ? "me" : "store"} label="Your location" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center px-4">
                      <span className="rounded-full bg-ink/85 px-4 py-2 text-xs font-medium text-bg backdrop-blur">
                        {available.length ? "Accept a task to start" : "Waiting for new tasks…"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {mine.active.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Active tasks">
                        {mine.active.map((t) => (
                          <button
                            key={t._id}
                            role="tab"
                            aria-selected={t._id === selectedId}
                            onClick={() => setSelectedId(t._id)}
                            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${t._id === selectedId ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
                          >
                            {t.orderNumber}
                          </button>
                        ))}
                      </div>
                    )}

                    {selected && action && (
                      <>
                        <div className="card relative h-[340px] overflow-hidden sm:h-[420px]">
                          <MapCanvas markers={markers} route={myPos ? route : null} fitKey={`${selected._id}|${selected.status}|${myPos ? "gps" : "nogps"}|${route ? "r" : ""}`} label="Navigation map" />
                        </div>

                        <div className="card p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                                {selected.leg === "pickup" ? "Pickup task" : "Delivery task"} &middot; {selected.orderNumber}
                              </p>
                              <h2 className="mt-1 text-xl font-bold">{action.go}</h2>
                            </div>
                            <StatusChip status={selected.status} />
                          </div>

                          <div className="mt-4 space-y-2 text-sm">
                            <p className="flex gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {action.dest === "store" ? `${config?.store?.name || "Store"} - ${config?.store?.address || ""}` : selected.pickupAddress}</p>
                            {selected.customer && (
                              <p className="flex items-center gap-2 text-muted">
                                <Icon name="user" className="h-4 w-4 text-brand" /> {selected.customer.name}
                                <a href={`tel:${selected.customer.phone}`} className="ml-1 font-semibold text-link hover:underline">{selected.customer.phone}</a>
                              </p>
                            )}
                            {selected.notes && <p className="rounded-xl bg-soft px-3 py-2 text-muted">&ldquo;{selected.notes}&rdquo;</p>}
                            <p className="text-xs text-muted">{selected.items.map((i) => `${i.serviceName} × ${i.quantity}${i.unit}`).join(", ")}</p>
                            {selected.status === "out_for_delivery" && (
                              <p className="rounded-xl bg-sun/25 px-3 py-2 font-semibold">Collect cash: {money(selected.totalAmount)}</p>
                            )}
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            {destination && (
                              <a href={directionsUrl(destination)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                                <Icon name="nav" className="h-4 w-4" /> Open in Google Maps
                              </a>
                            )}
                          </div>

                          <div className="mt-6 border-t border-line pt-5">
                            <p className="mb-3 text-sm text-muted">{action.hint}</p>
                            {action.needsOtp && (
                              <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="_ _ _ _"
                                aria-label="Customer OTP"
                                className="input mb-3 text-center font-display text-2xl font-extrabold tracking-[0.5em] sm:max-w-[14rem]"
                              />
                            )}
                            <button onClick={advance} disabled={busyId === selected._id} className="btn btn-primary w-full py-3.5 text-base">
                              {busyId === selected._id ? "Updating…" : action.label}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {DEV && (
                  <button onClick={() => { simPos.current = null; setSimulate((s) => !s); }} className="btn btn-ghost btn-sm w-full border border-dashed border-line text-muted">
                    {simulate ? "Stop GPS simulation" : "Dev: simulate GPS (moves toward the destination)"}
                  </button>
                )}
              </div>

              {/* ---------- right: available + history ---------- */}
              <div className="space-y-6">
                <section aria-label="Available tasks">
                  <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted">
                    Available tasks <span className="chip bg-brand/10 text-link">{available.length}</span>
                  </h2>
                  {!loaded && <div className="skeleton h-28 rounded-3xl" />}
                  {loaded && available.length === 0 && <p className="card p-6 text-center text-sm text-muted">No open tasks right now. New ones appear here instantly.</p>}
                  <div className="space-y-3">
                    {available.map((t) => (
                      <article key={`${t.orderId}-${t.leg}`} className="card p-5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`chip ${t.leg === "pickup" ? "bg-brand/15 text-link" : "bg-aqua/20 text-ink"}`}>{t.leg === "pickup" ? "Pickup" : "Delivery"}</span>
                            {t.express && <span className="chip bg-sun/30 text-ink"><Icon name="bolt" className="h-3 w-3" /> Express</span>}
                          </div>
                          <span className="font-display text-lg font-extrabold text-success">{money(t.payout)}</span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm">{t.address}</p>
                        <p className="mt-1 text-xs text-muted">
                          {t.toFirstStopKm != null ? `${t.toFirstStopKm} km to first stop · ` : ""}{t.tripKm} km trip &middot; {t.itemCount} item type{t.itemCount > 1 ? "s" : ""}
                        </p>
                        <button onClick={() => accept(t)} disabled={busyId === t.orderId} className="btn btn-primary mt-4 w-full">
                          {busyId === t.orderId ? "Accepting…" : "Accept task"}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                {mine.history.length > 0 && (
                  <section aria-label="Recent tasks">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Recent</h2>
                    <ul className="card divide-y divide-line">
                      {mine.history.map((h) => (
                        <li key={h._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold">{h.orderNumber}</p>
                            <p className="truncate text-xs text-muted">{h.pickupAddress}</p>
                          </div>
                          <div className="text-right">
                            <StatusChip status={h.status} />
                            <p className="mt-1 text-xs text-muted">{timeOnly(h.updatedAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
