import { io } from "socket.io-client";
import { SERVER_URL } from "./config";

let socket = null;
let socketToken = null;

// One shared authenticated connection for the whole app.
export function getSocket(token) {
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  if (socket) socket.disconnect();
  socketToken = token;
  socket = io(SERVER_URL, { auth: { token }, transports: ["websocket"], reconnectionDelayMax: 5000 });
  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketToken = null;
}
