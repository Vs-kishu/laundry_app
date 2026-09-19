"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api, { errMsg } from "../../../lib/api";
import { useRequireRole } from "../../../context/AuthContext";
import { getSocket } from "../../../lib/socket";
import Icon from "../../../components/Icons";
import { Alert, EmptyState, PageLoader, StatusChip } from "../../../components/ui";
import LocationPicker from "../../../components/LocationPicker";
import { itemsSummary, money, timeOnly } from "../../../lib/format";

const FILTERS = [
  ["open", "Open"],
  ["placed", "Needs pickup partner"],
  ["at_store", "At store"],
  ["in_progress", "Cleaning"],
  ["ready", "Needs delivery partner"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["", "All"],
];

const partnerName = (p) => (p ? p.name : null);

function OrderRow({ o, partners, onAction, busy }) {
  const [assignee, setAssignee] = useState("");
  const needsPickup = ["placed", "pickup_assigned"].includes(o.status);
  const needsDelivery = ["ready", "delivery_assigned"].includes(o.status);
  const open = !["delivered", "cancelled"].includes(o.status);

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {o.orderNumber} &middot; {timeOnly(o.createdAt)} {o.pickupType === "express" && <span className="ml-1 chip bg-sun/30 px-2 py-0.5 text-ink">Express</span>}
          </p>
          <p className="mt-1 truncate font-semibold">{itemsSummary(o.items)}</p>
          <p className="mt-0.5 text-sm text-muted">
            {o.customer?.name} &middot; {o.customer?.phone}
          </p>
        </div>
        <div className="text-right">
          <StatusChip status={o.status} />
          <p className="mt-1 font-display font-bold">{money(o.totalAmount)}</p>
        </div>
      </div>

      <p className="mt-3 flex gap-2 text-sm text-muted">
        <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" /> {o.pickupAddress}
      </p>

      {(o.pickupPartner || o.deliveryPartner) && (
        <p className="mt-2 text-xs text-muted">
          {o.pickupPartner && <>Pickup: <b className="text-ink">{partnerName(o.pickupPartner)}</b></>}
          {o.pickupPartner && o.deliveryPartner && " · "}
          {o.deliveryPartner && <>Delivery: <b className="text-ink">{partnerName(o.deliveryPartner)}</b></>}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {o.status === "at_store" && (
          <button disabled={busy} onClick={() => onAction("status", o._id, { status: "in_progress" })} className="btn btn-primary btn-sm">Start cleaning</button>
        )}
        {o.status === "in_progress" && (
          <button disabled={busy} onClick={() => onAction("status", o._id, { status: "ready" })} className="btn btn-primary btn-sm">Mark ready</button>
        )}
        {(needsPickup || needsDelivery) && (
          <div className="flex items-center gap-2">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input !w-auto !py-1.5 text-xs" aria-label="Choose partner">
              <option value="">{needsPickup ? "Assign pickup partner…" : "Assign delivery partner…"}</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.partner.isOnline ? "(online)" : "(offline)"}
                </option>
              ))}
            </select>
            <button
              disabled={!assignee || busy}
              onClick={() => onAction("assign", o._id, { leg: needsPickup ? "pickup" : "delivery", partnerId: assignee })}
              className="btn btn-secondary btn-sm"
            >
              Assign
            </button>
          </div>
        )}
        <Link href={`/orders/${o._id}`} className="btn btn-ghost btn-sm">
          View live <Icon name="chevron" className="h-3.5 w-3.5" />
        </Link>
        {open && (
          <button
            disabled={busy}
            onClick={() => window.confirm(`Cancel ${o.orderNumber}?`) && onAction("status", o._id, { status: "cancelled" })}
            className="btn btn-danger btn-sm ml-auto"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}

function StoreSettings() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/store").then(({ data }) => setForm({ ...data.store, phone: data.store.phone || "" })).catch((e) => setMsg({ tone: "danger", text: errMsg(e) }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.put("/store", { name: form.name, address: form.address, phone: form.phone, location: form.location, serviceRadiusKm: Number(form.serviceRadiusKm) });
      setMsg({ tone: "success", text: "Store saved. Customers will see the new location within a minute." });
    } catch (err) {
      setMsg({ tone: "danger", text: errMsg(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="mt-6 skeleton h-64 rounded-3xl" />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={save} className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Store details</h2>
        <div><label className="label" htmlFor="sname">Store name</label><input id="sname" className="input" value={form.name} onChange={set("name")} required /></div>
        <div><label className="label" htmlFor="saddr">Address</label><textarea id="saddr" rows={2} className="input" value={form.address} onChange={set("address")} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="sphone">Phone</label><input id="sphone" className="input" value={form.phone} onChange={set("phone")} /></div>
          <div><label className="label" htmlFor="srad">Delivery radius (km)</label><input id="srad" type="number" min="1" max="100" className="input" value={form.serviceRadiusKm} onChange={set("serviceRadiusKm")} required /></div>
        </div>
        <p className="text-xs text-muted">Location: {form.location.lat.toFixed(5)}, {form.location.lng.toFixed(5)}</p>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <button disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save store"}</button>
      </div>
      <div className="card p-6">
        <h2 className="mb-1 text-lg font-bold">Store location</h2>
        <p className="mb-4 text-sm text-muted">Search or tap the map to move the store. Orders are accepted within the radius of this point.</p>
        <LocationPicker value={form.location} onChange={({ address, ...p }) => setForm((f) => ({ ...f, location: p, address: address || f.address }))} />
      </div>
    </form>
  );
}

export default function AdminPage() {
  const { ready } = useRequireRole(["admin"], "/admin/login");
  const [tab, setTab] = useState("orders");
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState(null);
  const [pages, setPages] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [partners, setPartners] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(() => api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {}), []);
  const loadPartners = useCallback(() => api.get("/admin/partners").then(({ data }) => setPartners(data)).catch((e) => setError(errMsg(e))), []);
  const loadOrders = useCallback(
    () =>
      api
        .get("/orders", { params: { status: filter || undefined, page } })
        .then(({ data }) => {
          setOrders(data.orders);
          setPages({ page: data.page, pages: data.pages, total: data.total });
        })
        .catch((e) => setError(errMsg(e))),
    [filter, page]
  );

  const refreshAll = useCallback(() => {
    loadStats();
    loadOrders();
    loadPartners();
  }, [loadStats, loadOrders, loadPartners]);

  useEffect(() => {
    if (!ready) return;
    refreshAll();
    const socket = getSocket();
    socket?.on("order:update", refreshAll);
    socket?.on("partner:update", refreshAll);
    const poll = setInterval(refreshAll, 30000);
    return () => {
      clearInterval(poll);
      socket?.off("order:update", refreshAll);
      socket?.off("partner:update", refreshAll);
    };
  }, [ready, refreshAll]);

  const onAction = async (kind, id, body) => {
    setBusy(true);
    setError("");
    try {
      await api.put(`/orders/${id}/${kind}`, body);
      refreshAll();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id, status) => {
    setError("");
    try {
      await api.put(`/admin/partners/${id}/verification`, { status });
      refreshAll();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  if (!ready) return <PageLoader />;

  const approvedPartners = partners.filter((p) => p.partner?.verificationStatus === "approved");
  const S = stats?.byStatus || {};
  const cards = [
    ["Needs pickup partner", S.placed || 0, "bike"],
    ["In store", (S.at_store || 0) + (S.in_progress || 0), "store"],
    ["Ready for delivery", S.ready || 0, "package"],
    ["Delivered today", stats?.deliveredToday || 0, "check"],
    ["Revenue today", money(stats?.revenueToday || 0), "wallet"],
    ["Partners online", stats?.partnersOnline || 0, "user"],
  ];

  return (
    <div className="container-x max-w-6xl py-8">
      <h1 className="text-3xl font-extrabold">Dashboard</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([k, v, icon]) => (
          <div key={k} className="card p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><Icon name={icon} className="h-[18px] w-[18px]" /></span>
            <dd className="mt-3 font-display text-2xl font-extrabold">{stats ? v : "–"}</dd>
            <dt className="text-xs text-muted">{k}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex gap-2 border-b border-line" role="tablist">
        {[
          ["orders", "Orders"],
          ["store", "Store settings"],
          ["partners", `Partners${stats?.partnersPending ? ` (${stats.partnersPending} pending)` : ""}`],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === id ? "border-brand text-link" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {tab === "orders" && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">
            {FILTERS.map(([v, l]) => (
              <button
                key={l}
                onClick={() => { setFilter(v); setPage(1); }}
                aria-pressed={filter === v}
                className={`chip border ${filter === v ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-brand/40"}`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {orders === null && [0, 1].map((i) => <div key={i} className="skeleton h-40 rounded-3xl" />)}
            {orders?.length === 0 && <EmptyState title="No orders here">Nothing matches this filter right now.</EmptyState>}
            {orders?.map((o) => <OrderRow key={o._id} o={o} partners={approvedPartners} onAction={onAction} busy={busy} />)}
          </div>

          {pages.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-secondary btn-sm">Previous</button>
              <span className="text-muted">Page {pages.page} of {pages.pages}</span>
              <button disabled={page >= pages.pages} onClick={() => setPage((p) => p + 1)} className="btn btn-secondary btn-sm">Next</button>
            </div>
          )}
        </div>
      )}

      {tab === "store" && <StoreSettings />}

      {tab === "partners" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {partners.length === 0 && <div className="md:col-span-2"><EmptyState icon="user" title="No partners yet">Partners who apply at /partner/signup will appear here for approval.</EmptyState></div>}
          {partners.map((p) => {
            const st = p.partner?.verificationStatus;
            return (
              <article key={p._id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {p.name}
                      {p.partner?.isOnline && <span className="h-2 w-2 rounded-full bg-success" title="Online" />}
                    </p>
                    <p className="text-sm text-muted">{p.email} &middot; {p.phone}</p>
                  </div>
                  <span className={`chip ${st === "approved" ? "bg-success/15 text-success" : st === "rejected" ? "bg-danger/15 text-danger" : "bg-sun/30 text-ink"}`}>{st}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted">Vehicle</dt><dd className="capitalize">{p.partner?.vehicleType} &middot; {p.partner?.vehicleNumber}</dd></div>
                  <div><dt className="text-xs text-muted">Licence / ID</dt><dd>{p.partner?.licenseNumber}</dd></div>
                  <div><dt className="text-xs text-muted">Tasks done</dt><dd>{p.partner?.completedTasks || 0}</dd></div>
                  <div><dt className="text-xs text-muted">Earned</dt><dd>{money(p.partner?.earnings || 0)}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2 border-t border-line pt-4">
                  {st !== "approved" && <button onClick={() => verify(p._id, "approved")} className="btn btn-primary btn-sm">Approve</button>}
                  {st !== "rejected" && <button onClick={() => verify(p._id, "rejected")} className="btn btn-danger btn-sm">{st === "approved" ? "Suspend" : "Reject"}</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
