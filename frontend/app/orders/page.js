"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api, { errMsg } from "../../lib/api";
import { useRequireRole } from "../../context/AuthContext";
import { getSocket } from "../../lib/socket";
import Icon from "../../components/Icons";
import { Alert, EmptyState, PageLoader, StatusChip } from "../../components/ui";
import { ACTIVE_STATUSES, LIVE_STATUSES } from "../../lib/constants";
import { itemsSummary, money, shortDate, timeOnly } from "../../lib/format";

export default function OrdersPage() {
  const { ready } = useRequireRole(["customer"]);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    const load = () =>
      api
        .get("/orders/my")
        .then(({ data }) => setOrders(data))
        .catch((err) => setError(errMsg(err, "Couldn't load your orders.")));
    load();

    // status changes are pushed over the socket; no polling needed
    const socket = getSocket();
    socket?.on("order:update", load);
    return () => socket?.off("order:update", load);
  }, [ready]);

  if (!ready) return <PageLoader />;

  const active = (orders || []).filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = (orders || []).filter((o) => !ACTIVE_STATUSES.includes(o.status));

  const Card = ({ o }) => (
    <Link href={`/orders/${o._id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{o.orderNumber}</p>
          <p className="mt-1 truncate font-semibold">{itemsSummary(o.items)}</p>
          <p className="mt-1 text-sm text-muted">
            {o.pickupType === "express" ? `Express · ${shortDate(o.createdAt)}, ${timeOnly(o.createdAt)}` : `${shortDate(o.pickupDate)} · ${o.pickupSlot}`}
          </p>
        </div>
        <StatusChip status={o.status} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-muted">
          <Icon name="pin" className="h-4 w-4 shrink-0" />
          <span className="truncate">{o.pickupAddress}</span>
        </span>
        <span className="font-display font-bold">{money(o.totalAmount)}</span>
      </div>
      {LIVE_STATUSES.includes(o.status) && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-link">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-brand" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          Track live on map <Icon name="chevron" className="h-4 w-4" />
        </p>
      )}
    </Link>
  );

  return (
    <div className="container-x max-w-3xl py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">My orders</h1>
        <Link href="/book" className="btn btn-primary btn-sm">
          <Icon name="plus" className="h-4 w-4" /> New pickup
        </Link>
      </div>

      {error && <div className="mt-6"><Alert>{error}</Alert></div>}
      {orders === null && !error && (
        <div className="mt-8 space-y-4">
          {[0, 1].map((i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
        </div>
      )}

      {orders?.length === 0 && (
        <div className="mt-8">
          <EmptyState title="No orders yet" action={<Link href="/book" className="btn btn-primary">Book your first pickup</Link>}>
            Book a pickup and you&apos;ll be able to watch your partner arrive live on the map.
          </EmptyState>
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-8" aria-label="Active orders">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">In progress</h2>
          <div className="space-y-4">{active.map((o) => <Card key={o._id} o={o} />)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section className="mt-10" aria-label="Past orders">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Past orders</h2>
          <div className="space-y-4">{past.map((o) => <Card key={o._id} o={o} />)}</div>
        </section>
      )}
    </div>
  );
}
