"use client";

import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../../lib/api";
import { useRequireRole } from "../../context/AuthContext";
import { money, timeOnly } from "../../lib/format";
import { Alert, PageLoader } from "../../components/ui";

const EMPTY_DETAILS = { method: "upi", upiId: "", accountHolder: "", accountNumber: "", ifsc: "" };

export default function PartnerEarningsPage() {
  const { ready } = useRequireRole(["partner"], "/partner/login");
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    const { data } = await api.get("/partner/payout");
    setSummary(data);
    if (data.payoutDetails) setDetails({ ...EMPTY_DETAILS, ...data.payoutDetails });
  }, []);

  useEffect(() => {
    if (ready) loadSummary().catch((err) => setError(errMsg(err)));
  }, [ready, loadSummary]);

  const saveDetails = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const payload = details.method === "upi"
      ? { method: "upi", upiId: details.upiId }
      : { method: "bank", accountHolder: details.accountHolder, accountNumber: details.accountNumber, ifsc: details.ifsc };
    try {
      const { data } = await api.put("/partner/payout-details", payload);
      setDetails({ ...EMPTY_DETAILS, ...data.payoutDetails });
      setNotice("Payout details saved.");
      await loadSummary();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <PageLoader />;

  return (
    <main className="container-x max-w-4xl py-8">
      <h1 className="text-3xl font-extrabold">Earnings &amp; payouts</h1>
      <p className="mt-2 text-sm text-muted">
        Earn 10% of the final order total for each completed leg. Pickup earnings are recorded when you hand items to the store; delivery earnings are recorded after OTP-confirmed delivery. The admin transfers pending earnings manually to your saved payout method.
      </p>
      {error && <div className="mt-5"><Alert>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert tone="success">{notice}</Alert></div>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-muted">Pending payout</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{money(summary?.pending.amount || 0)}</p>
          <p className="mt-1 text-xs text-muted">{summary?.pending.count || 0} completed legs</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">Already paid</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{money(summary?.paid.amount || 0)}</p>
          <p className="mt-1 text-xs text-muted">{summary?.paid.count || 0} completed legs</p>
        </div>
      </section>

      <form onSubmit={saveDetails} className="card mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Payout method</h2>
          <p className="mt-1 text-sm text-muted">Add the UPI ID or bank account where the admin should send your earnings.</p>
        </div>
        <div className="flex gap-2">
          {["upi", "bank"].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setDetails((current) => ({ ...current, method }))}
              aria-pressed={details.method === method}
              className={`btn btn-sm ${details.method === method ? "btn-primary" : "btn-secondary"}`}
            >
              {method === "upi" ? "UPI ID" : "Bank account"}
            </button>
          ))}
        </div>
        {details.method === "upi" ? (
          <div>
            <label htmlFor="upi-id" className="label">UPI ID</label>
            <input id="upi-id" className="input" value={details.upiId} onChange={(event) => setDetails({ ...details, upiId: event.target.value })} placeholder="name@bank" required />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="account-holder" className="label">Account holder name</label>
              <input id="account-holder" className="input" value={details.accountHolder} onChange={(event) => setDetails({ ...details, accountHolder: event.target.value })} autoComplete="name" required minLength={2} maxLength={80} />
            </div>
            <div>
              <label htmlFor="account-number" className="label">Bank account number</label>
              <input id="account-number" className="input" inputMode="numeric" autoComplete="off" value={details.accountNumber} onChange={(event) => setDetails({ ...details, accountNumber: event.target.value.replace(/\D/g, "").slice(0, 20) })} required minLength={8} maxLength={20} />
            </div>
            <div>
              <label htmlFor="ifsc" className="label">IFSC code</label>
              <input id="ifsc" className="input uppercase" value={details.ifsc} onChange={(event) => setDetails({ ...details, ifsc: event.target.value.toUpperCase() })} autoComplete="off" required maxLength={11} />
            </div>
          </>
        )}
        {summary?.payoutDetails && (
          <p className="text-xs text-muted">
            Saved method: {summary.payoutDetails.method === "upi"
              ? summary.payoutDetails.upiId
              : `${summary.payoutDetails.accountHolder} · account ending ${summary.payoutDetails.accountNumber?.slice(-4) || "—"} · ${summary.payoutDetails.ifsc}`}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save payout details"}</button>
      </form>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Earning history</h2>
        <div className="mt-3 space-y-3">
          {summary?.earnings.length === 0 && <div className="card p-5 text-sm text-muted">Completed task earnings will appear here.</div>}
          {summary?.earnings.map((earning) => (
            <article key={earning._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{earning.order?.orderNumber || "Order"} · {earning.leg} leg</p>
                <p className="mt-1 text-xs capitalize text-muted">
                  {timeOnly(earning.earnedAt)} · {earning.status === "paid" ? `Paid · ${earning.payoutReference}` : "Pending admin payout"}
                </p>
              </div>
              <p className="font-display text-lg font-bold">{money(earning.amount)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
