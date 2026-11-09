"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../lib/socket";
import { STATUS_META } from "../lib/constants";

export default function RealtimeNotifications() {
  const { user } = useAuth();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    let timer;
    const show = (title, body, tag) => {
      setNotice({ title, body });
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), 6500);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, tag });
      }
    };
    const onOrder = ({ status, orderId }) => {
      const label = STATUS_META[status]?.label || status?.replaceAll("_", " ");
      const body = user.role === "partner"
        ? `Your delivery task is now ${label?.toLowerCase() || "updated"}.`
        : ["admin", "super_admin"].includes(user.role)
          ? `An order was ${label?.toLowerCase() || "updated"}.`
          : `Your order is now ${label?.toLowerCase() || "updated"}.`;
      show("Laundry Point order update", body, orderId);
    };
    const onTasks = () => show("New delivery task", "Open the partner app to see available pickups and deliveries.", "tasks");
    const onPartner = ({ status }) => show("Partner application update", `Your application status is ${status}.`, "partner-verification");
    const onPartnerUpdate = () => show("Partner update", "A delivery partner's account or availability changed.", "partner-update");
    socket.on("order:update", onOrder);
    socket.on("tasks:changed", onTasks);
    socket.on("partner:verification", onPartner);
    socket.on("partner:update", onPartnerUpdate);
    return () => {
      clearTimeout(timer);
      socket.off("order:update", onOrder);
      socket.off("tasks:changed", onTasks);
      socket.off("partner:verification", onPartner);
      socket.off("partner:update", onPartnerUpdate);
    };
  }, [user]);

  if (!user) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[1000] max-w-sm">
      {notice && (
        <div role="status" className="mb-3 rounded-2xl border border-line bg-surface p-4 shadow-lift">
          <p className="font-bold">{notice.title}</p>
          <p className="mt-1 text-sm text-muted">{notice.body}</p>
        </div>
      )}
      {"Notification" in (typeof window === "undefined" ? {} : window) && Notification.permission === "default" && (
        <button type="button" onClick={() => Notification.requestPermission()} className="btn btn-secondary btn-sm shadow-lift">
          Enable desktop notifications
        </button>
      )}
    </div>
  );
}
