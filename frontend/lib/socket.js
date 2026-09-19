import { io } from "socket.io-client";
import { SOCKET_URL } from "./site";

let socket = null;
let socketToken = null;

// One shared authenticated connection per browser tab.
export function getSocket() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (socket && socketToken === token) return socket;
  if (socket) socket.disconnect();

  socketToken = token;
  socket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: localStorage.getItem("token") }),
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketToken = null;
}
