"use client";

import { useEffect, useState } from "react";
import api, { errMsg } from "../lib/api";
import { Alert } from "./ui";

const EMPTY = {
  title: "",
  code: "",
  type: "percentage",
  value: "15",
  discountKind: "percentage",
  minimumQuantity: "0",
  minimumSubtotal: "0",
  maximumDiscount: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

const localInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function OffersPanel() {
  const [offers, setOffers] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/offers");
      setOffers(data);
    } catch (error) {
      setMessage({ tone: "danger", text: errMsg(error, "Couldn't load offers.") });
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = {
      ...form,
      code: form.code.trim().toUpperCase(),
      value: Number(form.type === "bogo" ? 100 : form.value),
      minimumQuantity: Number(form.minimumQuantity || 0),
      minimumSubtotal: Number(form.minimumSubtotal || 0),
      maximumDiscount: form.maximumDiscount === "" ? null : Number(form.maximumDiscount),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      if (editing) await api.put(`/admin/offers/${editing}`, body);
      else await api.post("/admin/offers", body);
      setMessage({ tone: "success", text: editing ? "Offer updated." : "Offer created." });
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (error) {
      setMessage({ tone: "danger", text: errMsg(error, "Couldn't save this offer.") });
    } finally {
      setBusy(false);
    }
  };

  const edit = (offer) => {
    setEditing(offer._id);
    setForm({
      ...EMPTY,
      ...offer,
      value: String(offer.value),
      minimumQuantity: String(offer.minimumQuantity || 0),
      minimumSubtotal: String(offer.minimumSubtotal || 0),
      maximumDiscount: offer.maximumDiscount == null ? "" : String(offer.maximumDiscount),
      startsAt: localInputDate(offer.startsAt),
      endsAt: localInputDate(offer.endsAt),
    });
    setMessage(null);
  };

  const disable = async (offer) => {
    try {
      await api.delete(`/admin/offers/${offer._id}`);
      setMessage({ tone: "success", text: `${offer.code} disabled.` });
      await load();
    } catch (error) {
      setMessage({ tone: "danger", text: errMsg(error, "Couldn't disable this offer.") });
    }
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {offers === null ? <div className="skeleton h-32 rounded-3xl" /> : offers.length === 0 ? (
          <div className="card p-6 text-sm text-muted">No offers created yet. Add a discount on the right.</div>
        ) : offers.map((offer) => (
          <article key={offer._id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-bold">{offer.title} <span className="chip ml-2 bg-brand/10 text-link">{offer.code}</span></p>
              <p className="mt-1 text-sm text-muted">
                {offer.type === "bogo" ? "Buy one, get one free" :
                  offer.type === "quantity" ? `${offer.value}${offer.discountKind === "percentage" ? "%" : " off"} at ${offer.minimumQuantity}+ units` :
                    offer.type === "percentage" ? `${offer.value}% off` : `${offer.value} off`}
                {offer.minimumSubtotal ? ` · min ${offer.minimumSubtotal}` : ""}
                {offer.maximumDiscount ? ` · cap ${offer.maximumDiscount}` : ""}
              </p>
              <p className={`mt-1 text-xs font-semibold ${offer.isActive ? "text-success" : "text-muted"}`}>{offer.isActive ? "Active" : "Disabled"}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => edit(offer)} className="btn btn-secondary btn-sm">Edit</button>
              {offer.isActive && <button type="button" onClick={() => disable(offer)} className="btn btn-ghost btn-sm text-danger">Disable</button>}
            </div>
          </article>
        ))}
      </section>

      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">{editing ? "Edit offer" : "Create offer"}</h2>
        <div><label className="label" htmlFor="offer-title">Offer name</label><input id="offer-title" className="input" value={form.title} onChange={set("title")} required maxLength={100} /></div>
        <div><label className="label" htmlFor="offer-code">Code</label><input id="offer-code" className="input uppercase" value={form.code} onChange={set("code")} required maxLength={24} pattern="[A-Za-z0-9_-]+" /></div>
        <div>
          <label className="label" htmlFor="offer-type">Offer type</label>
          <select id="offer-type" className="input" value={form.type} onChange={set("type")}>
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
            <option value="bogo">Buy one, get one free (item services)</option>
            <option value="quantity">Quantity/weight threshold</option>
          </select>
        </div>
        {form.type !== "bogo" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="offer-value">{form.type === "quantity" ? "Discount value" : form.type === "percentage" ? "Percent off" : "Amount off"}</label><input id="offer-value" className="input" type="number" min="0.01" step="0.01" value={form.value} onChange={set("value")} required /></div>
            {form.type === "quantity" && (
              <div><label className="label" htmlFor="offer-kind">Discount type</label><select id="offer-kind" className="input" value={form.discountKind} onChange={set("discountKind")}><option value="percentage">Percent</option><option value="fixed">Fixed amount</option></select></div>
            )}
          </div>
        )}
        {form.type === "quantity" && <div><label className="label" htmlFor="offer-minqty">Minimum quantity (kg/items)</label><input id="offer-minqty" className="input" type="number" min="0.5" step="0.5" value={form.minimumQuantity} onChange={set("minimumQuantity")} required /></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="offer-minimum">Minimum order subtotal</label><input id="offer-minimum" className="input" type="number" min="0" step="1" value={form.minimumSubtotal} onChange={set("minimumSubtotal")} /></div>
          <div><label className="label" htmlFor="offer-cap">Maximum discount</label><input id="offer-cap" className="input" type="number" min="0" step="1" value={form.maximumDiscount} onChange={set("maximumDiscount")} placeholder="No cap" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="offer-start">Starts (optional)</label><input id="offer-start" className="input" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} /></div>
          <div><label className="label" htmlFor="offer-end">Ends (optional)</label><input id="offer-end" className="input" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} /></div>
        </div>
        {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Offer is active</label>}
        <div className="flex gap-2">
          <button disabled={busy} className="btn btn-primary flex-1">{busy ? "Saving…" : editing ? "Update offer" : "Create offer"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="btn btn-secondary">Cancel</button>}
        </div>
      </form>
    </div>
  );
}
