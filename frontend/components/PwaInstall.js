"use client";

import { useEffect, useState } from "react";
import Icon from "./Icons";
import { LogoMark } from "./Logo";

const DISMISS_KEY = "pwa-install-dismissed";

// Registers the service worker and shows an "Install app" banner:
//  - Android/desktop Chrome/Edge: uses the browser's install prompt
//  - iPhone/iPad Safari (no prompt API): shows Share -> Add to Home Screen steps
export default function PwaInstall() {
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    let dismissed = false;
    try {
      dismissed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 7 * 86400000;
    } catch {}
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      setIos(true);
      setVisible(true);
    }

    const onPrompt = (e) => {
      e.preventDefault(); // keep the event so we can trigger it from our own button
      setDeferred(e);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Install Laundry Point" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-3xl border border-line bg-surface p-4 shadow-lift sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <LogoMark size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold">Install Laundry Point</p>
          {ios ? (
            <p className="mt-1 text-sm text-muted">
              Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Add the app to your home screen for faster booking and live tracking.</p>
          )}
          {!ios && (
            <button onClick={install} className="btn btn-primary btn-sm mt-3">
              <Icon name="plus" className="h-4 w-4" /> Install app
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-soft">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
