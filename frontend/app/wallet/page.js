"use client";

import { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../../lib/api";
import { useAuth, useRequireRole } from "../../context/AuthContext";
import { money, timeOnly } from "../../lib/format";
import { Alert, PageLoader } from "../../components/ui";

export default function WalletPage() {
  const { ready } = useRequireRole(["customer", "partner"], "/login");
  const { user, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("500");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWallet = useCallback(async () => {
    const { data } = await api.get("/wallet");
    setWallet(data);
  }, []);

  useEffect(() => {
    if (ready) loadWallet().catch((err) => setError(errMsg(err)));
  }, [ready, loadWallet]);

  const topUp = async () => {
    setBusy(true);
    setError("");
    try {
      const { data: checkout } = await api.post("/wallet/topups", { amount: Math.round(Number(amount) * 100) });
      if (!checkout.keyId) {
        throw new Error("Razorpay key ID is missing from the backend response. Set RAZORPAY_KEY_ID on the backend and restart or redeploy the API.");
      }
      const loaded = await new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      if (!loaded) throw new Error("Could not load the secure payment form. Check your connection and try again.");
      await new Promise((resolve) => {
        const payment = new window.Razorpay({
          key: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: checkout.name,
          description: checkout.description,
          order_id: checkout.orderId,
          prefill: checkout.prefill,
          method: { upi: true },
          theme: { color: "#2F6BFF" },
          handler: async (response) => {
            try {
              await api.post("/wallet/topups/verify", response);
              await Promise.all([loadWallet(), refreshUser()]);
              resolve();
            } catch (err) {
              setError(errMsg(err, "Payment verification failed. Refresh your wallet before retrying."));
              resolve();
            }
          },
          modal: { ondismiss: resolve },
        });
        payment.on("payment.failed", (response) => {
          setError(response.error?.description || "Payment failed. Please try again.");
          resolve();
        });
        payment.open();
      });
    } catch (err) {
      setError(errMsg(err, "Couldn't start your wallet top-up."));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <PageLoader />;

  return (
    <main className="container-x max-w-4xl py-8">
      <h1 className="text-3xl font-extrabold">Wallet</h1>
      <p className="mt-1 text-sm text-muted">
        {user.role === "partner" ? "Delivery earnings are credited here as soon as each task leg is completed. Withdrawals are not enabled yet." : "Add funds securely online and use your wallet to pay for orders."}
      </p>
      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <p className="text-sm font-semibold text-muted">Available balance</p>
          <p className="mt-2 font-display text-4xl font-extrabold">{money(wallet?.balance ?? user.walletBalance ?? 0)}</p>
          {user.role === "partner" && <p className="mt-2 text-sm text-muted">Lifetime earnings: {money(wallet?.lifetimeEarnings || 0)}</p>}
        </div>
        {user.role === "customer" && (
          <div className="card p-6">
            <h2 className="text-lg font-bold">Add money</h2>
            <p className="mt-1 text-sm text-muted">Secure Razorpay checkout. Choose UPI QR in checkout when offered by your payment methods.</p>
            <div className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="wallet-amount">Amount in rupees</label>
              <input id="wallet-amount" className="input" type="number" min="1" max="5000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <button className="btn btn-primary shrink-0" disabled={busy || Number(amount) < 1 || Number(amount) > 5000} onClick={topUp}>
                {busy ? "Opening…" : "Add funds"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Recent transactions</h2>
        <div className="mt-3 space-y-3">
          {wallet?.transactions.length === 0 && <div className="card p-6 text-sm text-muted">No wallet transactions yet.</div>}
          {wallet?.transactions.map((transaction) => (
            <article key={transaction._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{transaction.description}</p>
                <p className="mt-1 text-xs text-muted">{timeOnly(transaction.createdAt)} · {transaction.type.replaceAll("_", " ")}</p>
              </div>
              <p className={`font-display text-lg font-bold ${transaction.direction === "credit" ? "text-success" : "text-ink"}`}>
                {transaction.direction === "credit" ? "+" : "−"}{money(transaction.amount)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
