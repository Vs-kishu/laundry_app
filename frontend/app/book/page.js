"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api, { errMsg } from "../../lib/api";
import { useRequireRole } from "../../context/AuthContext";
import useStoreConfig from "../../hooks/useStoreConfig";
import LocationPicker from "../../components/LocationPicker";
import Icon from "../../components/Icons";
import { Alert, PageLoader } from "../../components/ui";
import { haversineKm } from "../../lib/geo";
import { localToday, money } from "../../lib/format";

const CATEGORY_ICON = { wash_fold: "wash", wash_iron: "shirt", dry_clean: "sparkles", iron_only: "iron" };

// "2:00 PM - 4:00 PM" -> 14 (start hour), used to disable slots that already started today
function slotStartHour(slot) {
  const m = slot.match(/^(\d{1,2}):\d{2}\s*(AM|PM)/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[2].toUpperCase() === "PM") h += 12;
  return h;
}

function Section({ step, title, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">{step}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function BookPage() {
  const { user, ready } = useRequireRole(["customer"]);
  const router = useRouter();
  const config = useStoreConfig();

  const [services, setServices] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [pickupType, setPickupType] = useState("express");
  const [pickupDate, setPickupDate] = useState(localToday());
  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.address) setAddress((a) => a || user.address);
  }, [user]);

  useEffect(() => {
    api
      .get("/services")
      .then(({ data }) => setServices(data))
      .catch((err) => {
        setServices([]);
        setError(errMsg(err, "Couldn't load services. Please refresh the page."));
      });
  }, []);

  const slots = useMemo(() => {
    const now = new Date().getHours();
    return (config?.slots || []).map((s) => ({
      label: s,
      disabled: pickupDate === localToday() && slotStartHour(s) <= now,
    }));
  }, [config, pickupDate]);

  // keep the selected slot valid when the date changes
  useEffect(() => {
    if (!slots.length) return;
    if (!slots.find((s) => s.label === pickupSlot && !s.disabled)) {
      setPickupSlot(slots.find((s) => !s.disabled)?.label || "");
    }
  }, [slots, pickupSlot]);

  const step = (service) => (service.unit === "kg" ? 0.5 : 1);
  const setQty = (service, delta) =>
    setQuantities((q) => {
      const next = Math.max(0, Math.min(100, Math.round(((q[service._id] || 0) + delta) * 10) / 10));
      return { ...q, [service._id]: next };
    });

  const selected = (services || []).filter((s) => quantities[s._id] > 0);
  const subtotal = selected.reduce((sum, s) => sum + s.pricePerUnit * quantities[s._id], 0);
  const fees = config?.fees;
  const deliveryFee = !selected.length || !fees ? 0 : subtotal >= fees.freeDeliveryAbove ? 0 : fees.delivery;
  const expressFee = pickupType === "express" && selected.length && fees ? fees.express : 0;
  const total = subtotal + deliveryFee + expressFee;

  const distanceKm = location && config?.store ? haversineKm(config.store.location, location) : null;
  const outOfArea = distanceKm != null && distanceKm > config.store.serviceRadiusKm;

  const onPick = ({ address: addr, ...point }) => {
    setLocation(point);
    if (addr) setAddress(addr);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selected.length) return setError("Add at least one item to your order.");
    if (!location) return setError("Drop a pin on the map so our partner can find you.");
    if (outOfArea) return setError("That location is outside our delivery area.");
    if (address.trim().length < 5) return setError("Enter a complete address (flat, building, landmark).");
    if (pickupType === "scheduled" && !pickupSlot) return setError("Pick a time slot.");

    setSubmitting(true);
    try {
      const { data } = await api.post("/orders", {
        items: selected.map((s) => ({ serviceId: s._id, quantity: quantities[s._id] })),
        pickupAddress: address.trim(),
        pickupLocation: location,
        pickupType,
        ...(pickupType === "scheduled" ? { pickupDate, pickupSlot } : {}),
        notes,
      });
      router.push(`/orders/${data._id}`);
    } catch (err) {
      setError(errMsg(err, "Couldn't place your order. Please try again."));
      setSubmitting(false);
    }
  };

  if (!ready) return <PageLoader />;

  const SummaryBody = (
    <>
      {selected.length === 0 ? (
        <p className="text-sm text-muted">Your basket is empty. Add items to see the total.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {selected.map((s) => (
            <li key={s._id} className="flex justify-between gap-3">
              <span className="text-muted">
                {s.name} &times; {quantities[s._id]} {s.unit}
              </span>
              <span className="font-medium">{money(s.pricePerUnit * quantities[s._id])}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-line pt-2 text-muted">
            <span>Delivery</span>
            <span className={deliveryFee === 0 ? "font-semibold text-success" : ""}>{deliveryFee === 0 ? "FREE" : money(deliveryFee)}</span>
          </li>
          {expressFee > 0 && (
            <li className="flex justify-between text-muted">
              <span>Express pickup</span>
              <span>{money(expressFee)}</span>
            </li>
          )}
        </ul>
      )}
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl font-extrabold">{money(total)}</span>
      </div>
      {fees && selected.length > 0 && deliveryFee > 0 && (
        <p className="mt-2 text-xs text-muted">Add {money(fees.freeDeliveryAbove - subtotal)} more for free delivery.</p>
      )}
      <p className="mt-2 text-xs text-muted">Pay on delivery.</p>
      {outOfArea && (
        <div className="mt-4">
          <Alert tone="warn">
            Your pin is {distanceKm.toFixed(1)} km from our store (we deliver within {config.store.serviceRadiusKm} km), so you can&apos;t confirm yet. Move the pin closer.
          </Alert>
        </div>
      )}
    </>
  );

  return (
    <div className="container-x py-8 pb-32 lg:pb-12">
      <h1 className="text-3xl font-extrabold">Book a pickup</h1>
      <p className="mt-1 text-muted">Choose items, drop a pin, and we&apos;ll send a partner.</p>
      {config?.fallback && (
        <div className="mt-4">
          <Alert tone="warn">Can&apos;t reach the server&apos;s store settings - restart the backend. Showing default slots.</Alert>
        </div>
      )}

      <form id="book-form" onSubmit={submit} className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section step="1" title="Choose your items">
            <div className="grid gap-3">
              {services === null && [0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
              {(services || []).map((s) => {
                const qty = quantities[s._id] || 0;
                return (
                  <div
                    key={s._id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 transition ${qty > 0 ? "border-brand bg-brand/5" : "border-line"}`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-brand">
                      <Icon name={CATEGORY_ICON[s.category] || "shirt"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted">{s.description}</p>
                      <p className="mt-0.5 text-sm font-semibold">
                        {money(s.pricePerUnit)} <span className="font-normal text-muted">/ {s.unit}</span>
                      </p>
                    </div>
                    {qty === 0 ? (
                      <button type="button" onClick={() => setQty(s, step(s))} className="btn btn-secondary btn-sm">
                        Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-full bg-brand p-1 text-white">
                        <button type="button" onClick={() => setQty(s, -step(s))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/20" aria-label={`Remove ${s.name}`}>
                          <Icon name="minus" className="h-4 w-4" />
                        </button>
                        <span className="min-w-[3rem] text-center text-sm font-bold" aria-live="polite">
                          {qty} {s.unit}
                        </span>
                        <button type="button" onClick={() => setQty(s, step(s))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/20" aria-label={`Add ${s.name}`}>
                          <Icon name="plus" className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Not sure of the weight? An estimate is fine - we weigh at pickup.</p>
          </Section>

          <Section step="2" title="Where should we pick up?">
            <LocationPicker value={location} onChange={onPick} store={config?.store} />
            {outOfArea && (
              <div className="mt-4">
                <Alert tone="warn">
                  That spot is {distanceKm.toFixed(1)} km from our store. We currently deliver within {config.store.serviceRadiusKm} km.
                </Alert>
              </div>
            )}
            <div className="mt-4">
              <label className="label" htmlFor="address">Full address</label>
              <textarea
                id="address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat / house no., building, street, landmark"
                className="input"
                required
              />
            </div>
          </Section>

          <Section step="3" title="When?">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pickup type">
              {[
                { id: "express", icon: "bolt", title: "Express", sub: `Pickup in ~${config?.expressEtaMinutes || 45} min`, extra: fees ? `+${money(fees.express)}` : "" },
                { id: "scheduled", icon: "clock", title: "Schedule", sub: "Pick a date and time slot", extra: "No extra fee" },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={pickupType === o.id}
                  onClick={() => setPickupType(o.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${pickupType === o.id ? "border-brand bg-brand/5 ring-4 ring-brand/10" : "border-line hover:border-brand/40"}`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${pickupType === o.id ? "bg-brand text-white" : "bg-soft text-brand"}`}>
                    <Icon name={o.icon} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-xs text-muted">{o.sub}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted">{o.extra}</span>
                </button>
              ))}
            </div>

            {pickupType === "scheduled" && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="label" htmlFor="date">Pickup date</label>
                  <input id="date" type="date" value={pickupDate} min={localToday()} onChange={(e) => setPickupDate(e.target.value)} className="input sm:max-w-xs" required />
                </div>
                <div>
                  <span className="label">Time slot</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time slot">
                    {slots.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        role="radio"
                        aria-checked={pickupSlot === s.label}
                        disabled={s.disabled}
                        onClick={() => setPickupSlot(s.label)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${pickupSlot === s.label ? "border-brand bg-brand text-white" : "border-line hover:border-brand/40"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className="label" htmlFor="notes">Note for the partner (optional)</label>
              <input id="notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. gate code, leave with security, call on arrival" className="input" />
            </div>
          </Section>
        </div>

        {/* Desktop summary */}
        <aside className="card hidden p-6 lg:sticky lg:top-24 lg:block">
          <h2 className="mb-4 text-lg font-bold">Order summary</h2>
          {SummaryBody}
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <button type="submit" disabled={submitting || outOfArea} className="btn btn-primary mt-5 w-full py-3.5 text-base">
            {submitting ? "Placing order…" : pickupType === "express" ? "Confirm express pickup" : "Confirm pickup"}
          </button>
        </aside>

        {/* Mobile summary */}
        <div className="space-y-4 lg:hidden">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Order summary</h2>
            {SummaryBody}
          </div>
          {error && <Alert>{error}</Alert>}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 p-3 backdrop-blur lg:hidden">
          <button type="submit" disabled={submitting || outOfArea} className="btn btn-primary w-full py-3.5 text-base">
            {submitting ? "Placing order…" : `Confirm pickup · ${money(total)}`}
          </button>
        </div>
      </form>
    </div>
  );
}
